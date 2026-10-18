"""SEC-B-07: the API's database account may only SELECT, INSERT, UPDATE and DELETE.

Each test builds a scratch database next to the test one and the three accounts for it. Roles live on the
whole server, so the fixture drops them again afterwards.
"""

import runpy
import secrets
import uuid
from collections.abc import Iterator

import psycopg
import pytest
from alembic.config import Config
from psycopg import sql
from sqlalchemy.engine import URL, make_url

from alembic import command
from app import bootstrap as bootstrap_module
from app.bootstrap import account_of, bootstrap, connect, provision_accounts
from app.config import settings
from tests.conftest import TEST_URL

SCRATCH_DATABASE = "kidsup_bootstrap_test"
OWNER_ROLE = "kidsup_owner_test"
APP_ROLE = "kidsup_app_test"
STRANGER_ROLE = "kidsup_stranger_test"
INSERT_APPLICATION = (
    "INSERT INTO applications (id, parent_name, phone, languages) "
    "VALUES (%s, 'Aysel', '+994 50 123 45 67', ARRAY['Rus']::varchar[])"
)

SERVER = make_url(TEST_URL).set(database="postgres")  # the test server's superuser


def url_of(role: str | None = None, password: str | None = None, database: str = SCRATCH_DATABASE) -> URL:
    return SERVER.set(
        database=database, username=role or SERVER.username, password=password or SERVER.password
    )


def drop_everything() -> None:
    with connect(SERVER) as conn:
        conn.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(SCRATCH_DATABASE))
        )
        for role in (OWNER_ROLE, APP_ROLE, STRANGER_ROLE):
            conn.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(role)))


@pytest.fixture
def scratch_database() -> Iterator[URL]:
    drop_everything()
    with connect(SERVER) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(SCRATCH_DATABASE)))
    yield url_of()
    drop_everything()


@pytest.fixture
def owner_url() -> URL:
    return url_of(OWNER_ROLE, secrets.token_hex(12))


@pytest.fixture
def app_url() -> URL:
    return url_of(APP_ROLE, secrets.token_hex(12))


def test_app_account_can_only_read_and_write_rows(scratch_database, owner_url, app_url):
    bootstrap(scratch_database, owner_url, app_url)

    application_id = uuid.uuid4()
    with connect(app_url) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute("UPDATE applications SET status = 'enrolled' WHERE id = %s", (application_id,))
        assert conn.execute("SELECT count(*) FROM applications").fetchone() == (1,)
        conn.execute("DELETE FROM applications WHERE id = %s", (application_id,))

        for forbidden in (
            "CREATE TABLE intruder (id int)",
            "ALTER TABLE applications ADD COLUMN extra int",
            "TRUNCATE applications",
            "DROP TABLE applications",
            "SELECT * FROM alembic_version",
            "CREATE ROLE intruder",
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(forbidden)


def test_accounts_are_not_superusers_and_the_owner_owns_the_tables(scratch_database, owner_url, app_url):
    bootstrap(scratch_database, owner_url, app_url)

    with connect(scratch_database) as conn:
        for role in (OWNER_ROLE, APP_ROLE):
            row = conn.execute(
                "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication "
                "FROM pg_roles WHERE rolname = %s",
                (role,),
            ).fetchone()
            assert row == (False, False, False, False), role
        owners = conn.execute(
            "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
        assert owners == [(OWNER_ROLE,)]


def test_strangers_cannot_connect_to_the_database(scratch_database, owner_url, app_url):
    bootstrap(scratch_database, owner_url, app_url)
    with connect(SERVER) as conn:
        conn.execute(
            sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                sql.Identifier(STRANGER_ROLE), sql.Literal("stranger-password")
            )
        )

    with pytest.raises(psycopg.OperationalError, match="permission denied"):
        connect(url_of(STRANGER_ROLE, "stranger-password"))


def test_a_database_created_before_the_split_keeps_its_rows(scratch_database, owner_url, app_url):
    # How the first deployment looked: the superuser migrated and therefore owns the tables.
    legacy = Config("alembic.ini")
    legacy.set_main_option("sqlalchemy.url", scratch_database.render_as_string(hide_password=False))
    command.upgrade(legacy, "head")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))

    bootstrap(scratch_database, owner_url, app_url)

    with connect(app_url) as conn:
        assert conn.execute("SELECT id FROM applications").fetchall() == [(application_id,)]
    with connect(scratch_database) as conn:
        owners = conn.execute(
            "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
        assert owners == [(OWNER_ROLE,)]


def test_running_again_is_harmless_and_rotates_the_password(scratch_database, owner_url, app_url):
    bootstrap(scratch_database, owner_url, app_url)
    rotated = app_url.set(password=secrets.token_hex(12))

    bootstrap(scratch_database, owner_url, rotated)

    with connect(rotated) as conn:
        assert conn.execute("SELECT 1").fetchone() == (1,)
    with pytest.raises(psycopg.OperationalError):
        connect(app_url)


def test_a_url_without_a_password_is_refused():
    with pytest.raises(ValueError, match="password"):
        account_of(make_url("postgresql://someone@db/kidsup"))


def test_main_sets_everything_up_from_the_settings(monkeypatch, scratch_database, owner_url, app_url):
    monkeypatch.setattr(
        settings, "admin_database_url", scratch_database.render_as_string(hide_password=False)
    )
    monkeypatch.setattr(settings, "migration_database_url", owner_url.render_as_string(hide_password=False))
    monkeypatch.setattr(settings, "database_url", app_url.render_as_string(hide_password=False))

    assert bootstrap_module.main() == 0

    with connect(app_url) as conn:
        assert conn.execute("SELECT count(*) FROM applications").fetchone() == (0,)


def test_main_refuses_to_run_without_the_privileged_urls(monkeypatch):
    monkeypatch.setattr(settings, "admin_database_url", None)
    assert bootstrap_module.main() == 2


# These two use a host nobody listens on: if the check they exercise were missing, they would fail with a
# connection error instead of touching a real server.
UNREACHABLE_ADMIN = "postgresql://admin:secret@127.0.0.1:1"


def test_the_admin_url_must_name_a_database(owner_url, app_url):
    with pytest.raises(ValueError, match="database name"):
        provision_accounts(make_url(UNREACHABLE_ADMIN), account_of(owner_url), account_of(app_url))


@pytest.mark.parametrize("system_database", ["postgres", "template0", "template1"])
def test_a_system_database_is_never_provisioned(system_database, owner_url, app_url):
    with pytest.raises(ValueError, match="system database"):
        provision_accounts(
            make_url(f"{UNREACHABLE_ADMIN}/{system_database}"), account_of(owner_url), account_of(app_url)
        )


def test_running_the_module_as_a_script_reports_a_missing_configuration(monkeypatch):
    monkeypatch.setattr(settings, "migration_database_url", None)
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("app.bootstrap", run_name="__main__")
    assert exit_info.value.code == 2
