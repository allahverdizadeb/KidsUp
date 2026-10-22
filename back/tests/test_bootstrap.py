"""SEC-B-07: four limited accounts, the API's able to add an application and nothing else.

Each test builds a scratch database next to the test one and the accounts for it (see conftest.py). Roles live
on the whole server, so the fixture drops them again afterwards.
"""

import runpy
import uuid
from typing import cast

import psycopg
import pytest
from alembic.config import Config
from psycopg import sql
from psycopg.rows import TupleRow
from sqlalchemy.engine import URL, make_url

from alembic import command
from app import bootstrap as bootstrap_module
from app.bootstrap import (
    APP_LIMITS,
    Account,
    Setup,
    UnsafeSetupError,
    bootstrap,
    connect,
    ensure_role,
    grant_statements,
    read_account,
)
from app.config import settings
from app.grants import Grant
from tests.scratch import APP_ROLE, OWNER_ROLE, PANEL_ROLE, RETENTION_ROLE, SERVER, STRANGER_ROLE, url_of

INSERT_APPLICATION = (
    "INSERT INTO applications (id, parent_name, phone, languages) "
    "VALUES (%s, 'Aysel', '+994 50 123 45 67', ARRAY['Rus']::varchar[])"
)
INSERT_CHILD = (
    "INSERT INTO application_children (id, application_id, position, name, birth_date) "
    "VALUES (%s, %s, 0, 'Leyla', '2016-03-14')"
)
ADMINISTRATIVE_FLAGS_OF_A_ROLE = (
    "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls "
    "FROM pg_roles WHERE rolname = %s"
)
RUNTIME_ROLES = [APP_ROLE, RETENTION_ROLE, PANEL_ROLE]
EVERY_ROLE = [OWNER_ROLE, *RUNTIME_ROLES]


def application_table_owners(url: URL) -> list[tuple[str]]:
    with connect(url) as conn:
        return conn.execute(
            "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()


# What the API's account is refused: reading details back, changing or removing rows, changing the schema.
@pytest.mark.parametrize(
    "statement",
    [
        "SELECT parent_name FROM applications",
        "SELECT created_at FROM applications",
        "SELECT count(*) FROM applications",
        "SELECT * FROM applications",
        "SELECT * FROM application_children",
        "SELECT * FROM courses",
        "SELECT * FROM admin_users",
        "SELECT * FROM audit_log",
        "UPDATE applications SET status = 'approved'",
        "UPDATE courses SET registration_open = true",
        "DELETE FROM applications",
        "TRUNCATE applications",
        "CREATE TABLE intruder (id int)",
        "ALTER TABLE applications ADD COLUMN extra int",
        "DROP TABLE applications",
        "SELECT * FROM alembic_version",
        "CREATE ROLE intruder",
        # It adds applications and children, and may not choose what only staff decide or the database knows:
        # an `approved` row would take seats, an old `created_at` would be deleted at once by retention.
        "INSERT INTO applications (id, parent_name, phone, languages, status) "
        "VALUES (gen_random_uuid(), 'A', '1', '{}', 'approved')",
        "INSERT INTO applications (id, parent_name, phone, languages, status_changed_at) "
        "VALUES (gen_random_uuid(), 'A', '1', '{}', now())",
        "INSERT INTO applications (id, parent_name, phone, languages, created_at) "
        "VALUES (gen_random_uuid(), 'A', '1', '{}', now() - interval '3 years')",
        "INSERT INTO audit_log (action) VALUES ('forged entry')",
        "INSERT INTO application_notes (id, application_id, body) "
        "VALUES (gen_random_uuid(), gen_random_uuid(), 'x')",
        "INSERT INTO courses (id) VALUES (gen_random_uuid())",
    ],
)
def test_the_api_account_is_refused_everything_but_adding_an_application(provisioned, statement):
    with connect(provisioned.app) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(statement)


@pytest.mark.parametrize("role", EVERY_ROLE)
def test_settings_made_on_an_existing_account_by_hand_are_cleared(
    scratch_database, owner_url, app_url, retention_url, panel_url, role
):
    with connect(SERVER) as conn:
        for name in EVERY_ROLE:
            conn.execute(sql.SQL("CREATE ROLE {} LOGIN").format(sql.Identifier(name)))
            conn.execute(sql.SQL("ALTER ROLE {} SET search_path = pg_temp").format(sql.Identifier(name)))
            conn.execute(sql.SQL("ALTER ROLE {} SET statement_timeout = '1h'").format(sql.Identifier(name)))

    bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)

    with connect(scratch_database) as conn:
        row = conn.execute("SELECT rolconfig FROM pg_roles WHERE rolname = %s", (role,)).fetchone()
    settings_of_role = (row[0] if row else None) or []
    assert not any(setting.startswith("search_path") for setting in settings_of_role)
    assert "statement_timeout=1h" not in settings_of_role


def test_the_api_account_can_add_an_application_and_its_children(provisioned):
    application_id = uuid.uuid4()
    with connect(provisioned.app) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id))

    with connect(provisioned.admin) as conn:
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (1,)


def test_the_api_account_stores_an_application_in_the_one_open_course_without_being_able_to_read_courses(
    provisioned,
):
    application_id = uuid.uuid4()
    with connect(provisioned.app) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))  # no course given: the trigger picks it

    with connect(provisioned.admin) as conn:
        course_of_application = conn.execute(
            "SELECT course_id FROM applications WHERE id = %s", (application_id,)
        ).fetchone()
        first_course = conn.execute("SELECT id FROM courses").fetchone()
    assert course_of_application == first_course


# What the retention account must be refused: reading names or birth dates, adding, changing anything at all,
# and the schema.
@pytest.mark.parametrize(
    "statement",
    [
        "SELECT parent_name FROM applications",
        "SELECT * FROM applications",
        "SELECT * FROM application_children",
        "SELECT * FROM courses",
        "DELETE FROM application_children",
        "INSERT INTO application_children (id) VALUES (gen_random_uuid())",
        "UPDATE applications SET phone = '000'",
        "UPDATE applications SET status = 'approved'",
        "TRUNCATE applications",
        "CREATE TABLE intruder (id int)",
        "SELECT * FROM alembic_version",
        "SELECT * FROM admin_users",
    ],
)
def test_the_retention_account_is_refused_reading_details_and_changing_anything(provisioned, statement):
    with connect(provisioned.retention) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(statement)


def test_the_retention_account_can_find_and_delete_applications_with_their_children_and_notes(provisioned):
    application_id = uuid.uuid4()
    with connect(provisioned.admin) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id))
        conn.execute(
            "INSERT INTO application_notes (id, application_id, body) VALUES (%s, %s, 'Called.')",
            (uuid.uuid4(), application_id),
        )

    with connect(provisioned.retention) as conn:
        assert conn.execute("SELECT id, created_at, status, phone FROM applications").fetchall()
        conn.execute("DELETE FROM applications WHERE id = %s", (application_id,))

    with connect(provisioned.admin) as conn:
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (0,)  # went with it
        assert conn.execute("SELECT count(*) FROM application_notes").fetchone() == (0,)


# The panel account reads personal data, so what it is refused matters as much as what it may do.
@pytest.mark.parametrize(
    "statement",
    [
        "INSERT INTO applications (id, parent_name, phone, languages) "
        "VALUES (gen_random_uuid(), 'A', '1', '{}')",
        "UPDATE applications SET parent_name = 'Someone else'",
        "UPDATE applications SET phone = '000'",
        "UPDATE applications SET consent_given_at = now()",
        "UPDATE applications SET privacy_notice_version = '2099-01-01'",
        "UPDATE applications SET course_id = gen_random_uuid()",
        "INSERT INTO application_children (id) VALUES (gen_random_uuid())",
        "UPDATE application_children SET name = 'Someone else'",
        "DELETE FROM application_children",
        "UPDATE application_notes SET body = 'Changed'",
        "UPDATE audit_log SET action = 'nothing happened'",
        "DELETE FROM audit_log",
        "TRUNCATE audit_log",
        "DELETE FROM admin_users",
        "TRUNCATE applications",
        "UPDATE site_publications SET content = '{}'",
        "DELETE FROM site_publications",
        "UPDATE media_assets SET sha256 = 'x'",
        "UPDATE admin_users SET email = 'someone@example.com'",
        "UPDATE admin_sessions SET admin_id = gen_random_uuid()",
        "SELECT * FROM alembic_version",
        "CREATE TABLE intruder (id int)",
        "CREATE ROLE intruder",
        "ALTER TABLE courses ADD COLUMN extra int",
        "DROP TABLE audit_log",
    ],
)
def test_the_panel_account_is_refused_what_staff_have_no_use_for(provisioned, statement):
    with connect(provisioned.panel) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(statement)


def test_the_panel_account_can_do_the_work_of_the_panel(provisioned):
    application_id, admin_id = uuid.uuid4(), uuid.uuid4()
    with connect(provisioned.admin) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id))

    with connect(provisioned.panel) as conn:
        assert conn.execute("SELECT parent_name, phone FROM applications").fetchall()
        assert conn.execute("SELECT name FROM application_children").fetchall()
        conn.execute(
            "INSERT INTO admin_users (id, email, display_name, role, password_hash, totp_secret) "
            "VALUES (%s, 'staff@example.com', 'Staff', 'admin', 'hash', 'secret')",
            (admin_id,),
        )
        conn.execute("UPDATE admin_users SET failed_logins = 1 WHERE id = %s", (admin_id,))
        conn.execute(
            "INSERT INTO admin_sessions (id, token_hash, admin_id, csrf_token, expires_at) "
            "VALUES (%s, 'hash', %s, 'csrf', now() + interval '1 hour')",
            (uuid.uuid4(), admin_id),
        )
        conn.execute(
            "INSERT INTO application_notes (id, application_id, admin_id, body) "
            "VALUES (%s, %s, %s, 'Called.')",
            (uuid.uuid4(), application_id, admin_id),
        )
        conn.execute("UPDATE applications SET status = 'contacted', status_changed_at = now()")
        conn.execute("UPDATE courses SET registration_open = false, updated_at = now()")
        conn.execute("INSERT INTO audit_log (action) VALUES ('login')")  # no right on a sequence is needed
        assert conn.execute("SELECT count(*) FROM audit_log").fetchone() == (1,)
        conn.execute("INSERT INTO site_content (key, value) VALUES ('hero.title', '\"Hello\"')")
        conn.execute("INSERT INTO site_publications (content) VALUES ('{}')")
        conn.execute("DELETE FROM applications WHERE id = %s", (application_id,))  # the notes go with it

    with connect(provisioned.admin) as conn:
        assert conn.execute("SELECT count(*) FROM application_notes").fetchone() == (0,)
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (0,)


def test_the_audit_log_cannot_be_changed_by_anybody_not_even_the_owner(provisioned):
    with connect(provisioned.panel) as conn:
        conn.execute("INSERT INTO audit_log (action) VALUES ('login')")

    # The superuser may do anything with a table, and still the triggers refuse: only dropping them helps.
    with connect(provisioned.admin) as conn:
        for statement in (
            "UPDATE audit_log SET action = 'nothing happened'",
            "DELETE FROM audit_log",
            "TRUNCATE audit_log",
        ):
            with pytest.raises(psycopg.errors.Error, match="append-only") as refusal:
                conn.execute(statement)
            assert refusal.value.sqlstate == "KU004"
        assert conn.execute("SELECT count(*) FROM audit_log").fetchone() == (1,)


@pytest.mark.parametrize("role", EVERY_ROLE)
def test_the_accounts_have_no_administrative_attributes(provisioned, role):
    with connect(provisioned.admin) as conn:
        flags = conn.execute(
            ADMINISTRATIVE_FLAGS_OF_A_ROLE,
            (role,),
        ).fetchone()
    assert flags == (False, False, False, False, False)


def test_the_owner_owns_every_table(provisioned):
    assert application_table_owners(provisioned.admin) == [(OWNER_ROLE,)]


@pytest.mark.parametrize("role", EVERY_ROLE)
def test_an_existing_account_with_wider_rights_is_cut_back(
    scratch_database, owner_url, app_url, retention_url, panel_url, role
):
    with connect(SERVER) as conn:
        for name in EVERY_ROLE:
            conn.execute(
                sql.SQL("CREATE ROLE {} LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS").format(
                    sql.Identifier(name)
                )
            )

    bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)

    with connect(scratch_database) as conn:
        flags = conn.execute(
            ADMINISTRATIVE_FLAGS_OF_A_ROLE,
            (role,),
        ).fetchone()
    assert flags == (False, False, False, False, False)


@pytest.mark.parametrize(
    ("role", "timeout"), [(APP_ROLE, "10s"), (RETENTION_ROLE, "60s"), (PANEL_ROLE, "60s")]
)
def test_a_runtime_account_has_a_statement_timeout(provisioned, role, timeout):
    with connect(provisioned.admin) as conn:
        row = conn.execute("SELECT rolconfig FROM pg_roles WHERE rolname = %s", (role,)).fetchone()
    assert row is not None
    assert f"statement_timeout={timeout}" in row[0]


def test_strangers_cannot_connect_to_the_database(provisioned):
    with connect(SERVER) as conn:
        conn.execute(
            sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                sql.Identifier(STRANGER_ROLE), sql.Literal("stranger-password")
            )
        )

    with pytest.raises(psycopg.OperationalError, match="permission denied"):
        connect(url_of(STRANGER_ROLE, "stranger-password"))


def test_a_wider_grant_made_by_hand_or_by_an_earlier_version_is_withdrawn(
    provisioned, scratch_database, owner_url, app_url, retention_url, panel_url
):
    with connect(provisioned.admin) as conn:
        conn.execute(
            sql.SQL("GRANT ALL ON ALL TABLES IN SCHEMA public TO {}").format(sql.Identifier(APP_ROLE))
        )
        conn.execute(
            sql.SQL("GRANT SELECT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {}").format(
                sql.Identifier(RETENTION_ROLE)
            )
        )
        conn.execute(
            sql.SQL("GRANT ALL ON ALL TABLES IN SCHEMA public TO {}").format(sql.Identifier(PANEL_ROLE))
        )

    bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)

    with connect(provisioned.app) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("SELECT parent_name FROM applications")
    with connect(provisioned.retention) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("UPDATE applications SET phone = '000'")
    with connect(provisioned.panel) as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("UPDATE audit_log SET action = 'nothing happened'")


def test_a_database_created_before_the_split_is_upgraded_and_keeps_its_rows(
    scratch_database, owner_url, app_url, retention_url, panel_url
):
    # How the first deployment looked: the superuser migrated (to the schema of that day) and owns the tables.
    legacy = Config("alembic.ini")
    legacy.set_main_option("sqlalchemy.url", scratch_database.render_as_string(hide_password=False))
    command.upgrade(legacy, "0001")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))

    bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)

    with connect(scratch_database) as conn:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == ("0011",)
        # The row is untouched: it predates the consent record, so that stays empty, and its status is "new".
        # It now belongs to the first course, the programme the landing page was advertising.
        assert conn.execute(
            "SELECT id, consent_given_at, privacy_notice_version, status FROM applications"
        ).fetchall() == [(application_id, None, None, "new")]
        assert conn.execute(
            "SELECT count(*) FROM applications WHERE course_id IN (SELECT id FROM courses)"
        ).fetchone() == (1,)
    assert application_table_owners(scratch_database) == [(OWNER_ROLE,)]
    with connect(retention_url) as conn:
        assert conn.execute("SELECT id FROM applications").fetchall() == [(application_id,)]


def test_running_again_is_harmless_and_rotates_the_password(
    provisioned, scratch_database, owner_url, retention_url, panel_url
):
    rotated = provisioned.app.set(password="a-new-password-of-24-characters")

    bootstrap(scratch_database, owner_url, rotated, retention_url, panel_url)

    with connect(rotated) as conn:
        assert conn.execute("SELECT 1").fetchone() == (1,)
    with pytest.raises(psycopg.OperationalError):
        connect(provisioned.app)


def test_a_grant_becomes_one_statement_for_each_kind_of_privilege():
    role = sql.Identifier("someone")

    everything = Grant("t", privileges=("DELETE",), readable_columns=("a", "b"), writable_columns=("c",))
    assert [statement.as_string() for statement in grant_statements(role, everything)] == [
        'GRANT DELETE ON TABLE "public"."t" TO "someone"',
        'GRANT SELECT ("a", "b") ON TABLE "public"."t" TO "someone"',
        'GRANT UPDATE ("c") ON TABLE "public"."t" TO "someone"',
    ]
    columns_only = Grant("t", readable_columns=("a",))
    assert [statement.as_string() for statement in grant_statements(role, columns_only)] == [
        'GRANT SELECT ("a") ON TABLE "public"."t" TO "someone"'
    ]


class RecordingConnection:
    """Passes everything to a real connection and keeps the text of every statement sent."""

    def __init__(self, conn: psycopg.Connection[TupleRow]) -> None:
        self.conn = conn
        self.statements: list[str] = []

    @property
    def pgconn(self):
        return self.conn.pgconn

    def execute(self, query, params=None):
        text = query.as_string(self.conn) if isinstance(query, sql.Composable) else query
        self.statements.append(text)
        return self.conn.execute(query, params)


def test_a_password_is_sent_as_a_scram_verifier_never_in_clear(scratch_database):
    password = "clear-text-password-never-sent-0123"
    with connect(scratch_database) as conn:
        recorder = RecordingConnection(conn)
        ensure_role(cast("psycopg.Connection[TupleRow]", recorder), Account(OWNER_ROLE, password), APP_LIMITS)

    sent = "\n".join(recorder.statements)
    assert password not in sent  # a failing statement is written to the server's log with its text
    assert "PASSWORD 'SCRAM-SHA-256$" in sent
    # And it is a working password: the server accepted the verifier as that password.
    with connect(url_of(OWNER_ROLE, password)) as owner_conn:
        assert owner_conn.execute("SELECT 1").fetchone() == (1,)


def test_a_database_that_holds_foreign_tables_is_left_alone(
    scratch_database, owner_url, app_url, retention_url, panel_url
):
    with connect(scratch_database) as conn:
        conn.execute("CREATE TABLE someone_elses_data (id int)")

    with pytest.raises(UnsafeSetupError, match="not KidsUp's"):
        bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)

    with connect(scratch_database) as conn:
        assert conn.execute(
            "SELECT tableowner FROM pg_tables WHERE tablename = 'someone_elses_data'"
        ).fetchone() == (SERVER.username,)
        assert conn.execute(
            "SELECT count(*) FROM pg_roles WHERE rolname = ANY(%s)", (EVERY_ROLE,)
        ).fetchone() == (0,)  # no account was created before the refusal


def test_the_connection_keeps_the_tls_settings_of_the_url(monkeypatch):
    captured = []
    monkeypatch.setattr(psycopg, "connect", lambda conninfo, **_: captured.append(conninfo))

    connect(make_url("postgresql://u:p@db:5432/d?sslmode=verify-full&sslrootcert=/etc/ca.pem"))

    assert "sslmode=verify-full" in captured[0]
    assert "sslrootcert=/etc/ca.pem" in captured[0]
    assert "connect_timeout=10" in captured[0]  # a default, so that a dead host fails fast


def test_a_timeout_in_the_url_wins_over_the_default(monkeypatch):
    captured = []
    monkeypatch.setattr(psycopg, "connect", lambda conninfo, **_: captured.append(conninfo))

    connect(make_url("postgresql://u:p@db:5432/d?connect_timeout=3"))

    assert "connect_timeout=3" in captured[0]


# --- the safety checks: all of them run before a connection is made, so these use a host nobody listens
# on. If a check were missing, the test would fail with a connection error instead of touching a server.

UNREACHABLE = "postgresql://{role}:{password}@127.0.0.1:1/kidsup"
STRONG = {
    "admin": "admin-password-0000000000000000",
    "owner": "o" * 24,
    "app": "a" * 24,
    "retention": "r" * 24,
    "panel": "p" * 24,
}
ROLES = {
    "admin": "kidsup",
    "owner": "kidsup_owner",
    "app": "kidsup_app",
    "retention": "kidsup_retention",
    "panel": "kidsup_panel",
}
FIVE_URLS = tuple[URL, URL, URL, URL, URL]


def urls(**changes: str) -> FIVE_URLS:
    """The five URLs on an unreachable host, with the roles and passwords named in `changes` replaced."""
    values = {
        f"{who}_{what}": (ROLES if what == "role" else STRONG)[who]
        for who in ROLES
        for what in ("role", "password")
    }
    values.update(changes)
    return cast(
        "FIVE_URLS",
        tuple(
            make_url(UNREACHABLE.format(role=values[f"{who}_role"], password=values[f"{who}_password"]))
            for who in ("admin", "owner", "app", "retention", "panel")
        ),
    )


def test_urls_that_pass_every_check_are_accepted():
    setup = Setup.validated(*urls())
    assert (setup.owner.role, setup.app.role, setup.retention.role, setup.panel.role) == (
        "kidsup_owner",
        "kidsup_app",
        "kidsup_retention",
        "kidsup_panel",
    )


def test_the_admin_url_must_name_a_database():
    admin, owner, app, retention, panel = urls()
    with pytest.raises(UnsafeSetupError, match="database name"):
        Setup.validated(
            admin._replace(database=None), owner, app, retention, panel
        )  # URL.set(database=None) keeps it


@pytest.mark.parametrize("system_database", ["postgres", "template0", "template1"])
def test_a_system_database_is_never_provisioned(system_database):
    with pytest.raises(UnsafeSetupError, match="system database"):
        Setup.validated(*(url.set(database=system_database) for url in urls()))


@pytest.mark.parametrize("who", ["owner", "app", "retention", "panel"])
@pytest.mark.parametrize("difference", [{"host": "10.0.0.5"}, {"port": 5433}, {"database": "other"}])
def test_every_account_must_name_the_same_server_and_database(who, difference):
    admin, owner, app, retention, panel = urls()
    urls_by_name = {"owner": owner, "app": app, "retention": retention, "panel": panel}
    urls_by_name[who] = urls_by_name[who].set(**difference)
    with pytest.raises(UnsafeSetupError, match="same server and database"):
        Setup.validated(
            admin,
            urls_by_name["owner"],
            urls_by_name["app"],
            urls_by_name["retention"],
            urls_by_name["panel"],
        )


@pytest.mark.parametrize(
    "changes",
    [
        {"app_role": "kidsup_owner"},  # the API with the schema owner's rights
        {"retention_role": "kidsup_app"},
        {"panel_role": "kidsup_retention"},
        {"panel_role": "kidsup_app"},  # the admin panel with the public API's account
        {"owner_role": "kidsup"},  # the superuser demoted by ALTER ROLE ... NOSUPERUSER
        {"app_role": "kidsup"},
        {"panel_role": "kidsup"},
    ],
    ids=[
        "app=owner",
        "retention=app",
        "panel=retention",
        "panel=app",
        "owner=admin",
        "app=admin",
        "panel=admin",
    ],
)
def test_the_five_accounts_must_be_five_different_roles(changes):
    with pytest.raises(UnsafeSetupError, match="five different roles"):
        Setup.validated(*urls(**changes))


@pytest.mark.parametrize("who", ["owner", "app", "retention", "panel"])
@pytest.mark.parametrize("role", ["postgres", "pg_monitor", "pg_read_all_data"])
def test_a_built_in_role_is_never_rewritten(who, role):
    with pytest.raises(UnsafeSetupError, match="reserved role name"):
        Setup.validated(*urls(**{f"{who}_role": role}))


def test_the_api_account_defaulting_to_postgres_is_refused():
    # KIDSUP_DATABASE_URL missing: the settings fall back to postgres:postgres@localhost.
    with pytest.raises(UnsafeSetupError, match="reserved role name"):
        Setup.validated(*urls(app_role="postgres", app_password="postgres"))


@pytest.mark.parametrize("who", ["owner", "app", "retention", "panel"])
def test_a_short_password_is_refused(who):
    with pytest.raises(UnsafeSetupError, match="at least 24 characters"):
        Setup.validated(*urls(**{f"{who}_password": "short"}))


@pytest.mark.parametrize(
    "changes",
    [
        {"app_password": "o" * 24},  # the same as the owner's
        {"retention_password": "a" * 24},
        {"panel_password": "r" * 24},  # the same as the retention account's
        {"owner_password": STRONG["admin"]},  # the same as the superuser's
    ],
    ids=["app=owner", "retention=app", "panel=retention", "owner=admin"],
)
def test_the_five_accounts_need_five_different_passwords(changes):
    with pytest.raises(UnsafeSetupError, match="five different passwords"):
        Setup.validated(*urls(**changes))


def test_a_short_superuser_password_is_refused():
    # The API's container can reach the superuser over the internal network, so its password matters too.
    with pytest.raises(UnsafeSetupError, match="'kidsup' must be at least 24 characters"):
        Setup.validated(*urls(admin_password="short-superuser-pw"))


def test_the_throw_away_superuser_of_a_development_postgres_on_this_machine_may_keep_a_short_password():
    setup = Setup.validated(*urls(admin_role="postgres", admin_password="postgres"))

    assert setup.admin_url.username == "postgres"


def test_the_postgres_superuser_with_a_short_password_is_refused_on_any_other_machine():
    urls_on_another_machine = (
        url.set(host="10.0.0.5") for url in urls(admin_role="postgres", admin_password="postgres")
    )

    with pytest.raises(UnsafeSetupError, match="'postgres' must be at least 24 characters"):
        Setup.validated(*urls_on_another_machine)


def test_a_url_without_a_password_is_refused():
    with pytest.raises(UnsafeSetupError, match="password"):
        read_account(make_url("postgresql://someone@db/kidsup"))


def test_bootstrap_validates_before_it_connects():
    with pytest.raises(UnsafeSetupError, match="reserved role name"):
        bootstrap(*urls(app_role="postgres"))


# --- main() reads the URLs from the settings


def use_settings(monkeypatch, admin, owner, app, retention, panel):
    def rendered(url: URL | None) -> str | None:
        return url.render_as_string(hide_password=False) if url else None

    monkeypatch.setattr(settings, "admin_database_url", rendered(admin))
    monkeypatch.setattr(settings, "migration_database_url", rendered(owner))
    monkeypatch.setattr(settings, "database_url", app.render_as_string(hide_password=False))
    monkeypatch.setattr(settings, "retention_database_url", rendered(retention))
    monkeypatch.setattr(settings, "panel_database_url", rendered(panel))


def test_main_sets_everything_up_from_the_settings(
    monkeypatch, scratch_database, owner_url, app_url, retention_url, panel_url
):
    use_settings(monkeypatch, scratch_database, owner_url, app_url, retention_url, panel_url)

    assert bootstrap_module.main() == 0

    with connect(app_url) as conn:
        assert conn.execute("SELECT 1").fetchone() == (1,)
    with connect(panel_url) as conn:
        assert conn.execute("SELECT count(*) FROM courses").fetchone() == (1,)


@pytest.mark.parametrize("missing", ["admin", "owner", "retention", "panel"])
def test_main_refuses_to_run_without_the_privileged_urls(monkeypatch, missing):
    admin, owner, app, retention, panel = urls()
    given: dict[str, URL | None] = {"admin": admin, "owner": owner, "retention": retention, "panel": panel}
    given[missing] = None
    use_settings(monkeypatch, given["admin"], given["owner"], app, given["retention"], given["panel"])

    assert bootstrap_module.main() == 2


def test_main_reports_an_unsafe_setup_instead_of_crashing(monkeypatch, caplog):
    use_settings(monkeypatch, *urls(app_role="postgres"))

    assert bootstrap_module.main() == 2
    assert "refusing to set up the database" in caplog.text
    assert "a" * 24 not in caplog.text  # the message names a role, never a password


@pytest.mark.filterwarnings("ignore:'app.bootstrap' found in sys.modules:RuntimeWarning")
def test_running_the_module_as_a_script_reports_a_missing_configuration(monkeypatch):
    monkeypatch.setattr(settings, "migration_database_url", None)
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("app.bootstrap", run_name="__main__")
    assert exit_info.value.code == 2
