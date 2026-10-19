"""One-off database setup, run before the API starts (SEC-B-07).

Four accounts keep a compromised API from owning, reading or wiping the database:

* admin (the PostgreSQL superuser): used only here, to create the other accounts and set grants;
* owner: owns the tables and runs the Alembic migrations;
* app: what the API connects as. It can add an application and nothing else: it cannot read anything back (not
  even a count), change a row or delete one;
* retention: what the retention job and the operator's commands connect as. It reads only what it matches on,
  deletes expired or erased applications and sets their status. The API never has this account's password.

Every step is idempotent, so the job runs on every start. It also upgrades a database that was created before
the split: its tables change owner and any earlier, wider grant is withdrawn; no row is touched.
"""

import logging
import sys
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path

import psycopg
from alembic.config import Config
from psycopg import sql
from psycopg.conninfo import make_conninfo
from psycopg.rows import TupleRow
from sqlalchemy.engine import URL, make_url

from alembic import command
from app.config import settings
from app.logging_config import configure_logging

logger = logging.getLogger(__name__)

BACK_DIRECTORY = Path(__file__).resolve().parents[1]
SYSTEM_DATABASES = frozenset({"postgres", "template0", "template1"})
SCHEMA = sql.Identifier("public")
MIGRATION_TABLE = "alembic_version"
ROLE_OPTIONS = sql.SQL("LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS")
MIN_PASSWORD_LENGTH = 24
CONNECT_TIMEOUT_SECONDS = 10


class UnsafeSetupError(ValueError):
    """The URLs would change an account or a database that is not KidsUp's, or would weaken the separation."""


@dataclass(frozen=True, slots=True)
class Account:
    role: str
    password: str


@dataclass(frozen=True, slots=True)
class Grant:
    """What one account may do with one table. Anything not listed here is not allowed."""

    table: str
    privileges: tuple[str, ...] = ()  # on the whole table
    readable_columns: tuple[str, ...] = ()  # SELECT on these columns only
    writable_columns: tuple[str, ...] = ()  # UPDATE on these columns only


# The API adds an application and its children and cannot read anything back (the ORM does not need to:
# `eager_defaults` is off in models.py).
APP_GRANTS = (
    Grant("applications", privileges=("INSERT",)),
    Grant("application_children", privileges=("INSERT",)),
)
# The retention job and the operator's commands: find what to delete by status, age or phone number, delete it
# (the children go with it through ON DELETE CASCADE, which runs with the owner's rights), mark an enrolment.
RETENTION_GRANTS = (
    Grant(
        "applications",
        privileges=("DELETE",),
        readable_columns=("id", "created_at", "status", "phone"),
        writable_columns=("status",),
    ),
)
# Role-level limits: a runaway query or a forgotten transaction cannot hold the database.
APP_LIMITS = {"statement_timeout": "10s", "idle_in_transaction_session_timeout": "15s"}
RETENTION_LIMITS = {"statement_timeout": "60s", "idle_in_transaction_session_timeout": "60s"}


@dataclass(frozen=True, slots=True)
class Setup:
    """Four database URLs that passed every safety check. The steps below accept nothing else."""

    admin_url: URL
    owner_url: URL
    database: str
    owner: Account
    app: Account
    retention: Account

    @classmethod
    def validated(cls, admin_url: URL, owner_url: URL, app_url: URL, retention_url: URL) -> "Setup":
        """Refuse anything that could change an account or database that is not ours. Makes no connection."""
        if admin_url.database is None:
            raise UnsafeSetupError("The admin database URL needs a database name.")
        if admin_url.database in SYSTEM_DATABASES:
            # Accounts and privileges are changed for the application's own database, never for the server's.
            raise UnsafeSetupError("Refusing to change accounts and privileges of a system database.")
        for name, url in (("owner", owner_url), ("app", app_url), ("retention", retention_url)):
            if (url.host, url.port, url.database) != (admin_url.host, admin_url.port, admin_url.database):
                raise UnsafeSetupError(
                    f"The {name} URL must name the same server and database as the admin URL."
                )

        admin = read_account(admin_url)
        owner, app, retention = read_account(owner_url), read_account(app_url), read_account(retention_url)
        accounts = (admin, owner, app, retention)
        if len({account.role for account in accounts}) != len(accounts):
            raise UnsafeSetupError(
                "The admin, owner, app and retention accounts must be four different roles."
            )
        if len({account.password for account in accounts}) != len(accounts):
            raise UnsafeSetupError("The four accounts must have four different passwords.")
        for account in (owner, app, retention):
            if account.role == "postgres" or account.role.startswith("pg_"):
                # CREATE/ALTER ROLE would rewrite a built-in account (or fail half-way through).
                raise UnsafeSetupError(f"{account.role!r} is a reserved role name; choose another.")
            if len(account.password) < MIN_PASSWORD_LENGTH:
                raise UnsafeSetupError(
                    f"The password of {account.role!r} must be at least {MIN_PASSWORD_LENGTH} characters."
                )
        return cls(admin_url, owner_url, admin_url.database, owner, app, retention)


def read_account(url: URL) -> Account:
    if not url.username or not url.password:
        raise UnsafeSetupError("A database URL needs a user name and a password.")
    return Account(role=url.username, password=url.password)


def connect(url: URL) -> psycopg.Connection[TupleRow]:
    # The URL's query string (sslmode, sslrootcert ...) carries the TLS settings. Dropping it would silently
    # weaken the connection that carries the superuser's password.
    options = {key: value if isinstance(value, str) else value[-1] for key, value in url.query.items()}
    options.setdefault("connect_timeout", str(CONNECT_TIMEOUT_SECONDS))
    conninfo = make_conninfo(
        host=url.host,
        port=url.port,
        user=url.username,
        password=url.password,
        dbname=url.database,
        **options,
    )
    return psycopg.connect(conninfo, autocommit=True)


def password_verifier(conn: psycopg.Connection[TupleRow], account: Account) -> str:
    """The password the way PostgreSQL stores it (SCRAM-SHA-256), computed here.

    Sent like this the clear text is never part of a statement, so it can never reach the server's log (a
    failing statement is logged with its text).
    """
    encrypted = conn.pgconn.encrypt_password(
        account.password.encode(), account.role.encode(), b"scram-sha-256"
    )
    return encrypted.decode()


def ensure_role(conn: psycopg.Connection[TupleRow], account: Account, limits: Mapping[str, str]) -> None:
    """Create the role, or reset its attributes, password and limits to the configured ones."""
    role = sql.Identifier(account.role)
    exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (account.role,)).fetchone()
    conn.execute(
        sql.SQL("{verb} ROLE {role} {options} PASSWORD {verifier}").format(
            verb=sql.SQL("ALTER" if exists else "CREATE"),
            role=role,
            options=ROLE_OPTIONS,
            verifier=sql.Literal(password_verifier(conn, account)),
        )
    )
    for setting, value in limits.items():
        conn.execute(
            sql.SQL("ALTER ROLE {} SET {} = {}").format(role, sql.Identifier(setting), sql.Literal(value))
        )


def require_our_database(conn: psycopg.Connection[TupleRow]) -> None:
    """A database that already holds tables must be KidsUp's own: it has the migration bookkeeping table."""
    tables = {name for (name,) in conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")}
    if tables and MIGRATION_TABLE not in tables:
        raise UnsafeSetupError("This database holds tables that are not KidsUp's; refusing to change them.")


def provision_accounts(setup: Setup) -> None:
    database = sql.Identifier(setup.database)
    owner_role = sql.Identifier(setup.owner.role)
    runtime_roles = sql.SQL(", ").join(sql.Identifier(a.role) for a in (setup.app, setup.retention))
    with connect(setup.admin_url) as conn:
        require_our_database(conn)
        ensure_role(conn, setup.owner, {})
        ensure_role(conn, setup.app, APP_LIMITS)
        ensure_role(conn, setup.retention, RETENTION_LIMITS)
        # Nobody else may connect or create objects; each account gets exactly what it needs.
        conn.execute(sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(database))
        conn.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO {}, {}").format(database, owner_role, runtime_roles)
        )
        conn.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(SCHEMA))
        conn.execute(sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(SCHEMA, runtime_roles))
        conn.execute(sql.SQL("GRANT USAGE, CREATE ON SCHEMA {} TO {}").format(SCHEMA, owner_role))
        # A database created before this split has tables owned by the superuser.
        foreign_tables = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> %s",
            (setup.owner.role,),
        ).fetchall()
        for (table,) in foreign_tables:
            conn.execute(
                sql.SQL("ALTER TABLE {}.{} OWNER TO {}").format(SCHEMA, sql.Identifier(table), owner_role)
            )


def run_migrations(setup: Setup) -> None:
    config = Config(str(BACK_DIRECTORY / "alembic.ini"))
    # ConfigParser treats "%" specially, and a URL or a path may contain it.
    config.set_main_option("script_location", str(BACK_DIRECTORY / "alembic").replace("%", "%%"))
    config.set_main_option(
        "sqlalchemy.url", setup.owner_url.render_as_string(hide_password=False).replace("%", "%%")
    )
    command.upgrade(config, "head")


def grant_statements(role: sql.Identifier, grant: Grant) -> Iterator[sql.Composed]:
    table = sql.SQL("{}.{}").format(SCHEMA, sql.Identifier(grant.table))

    def columns(names: tuple[str, ...]) -> sql.Composed:
        return sql.SQL(", ").join(sql.Identifier(name) for name in names)

    if grant.privileges:
        privileges = sql.SQL(", ").join(sql.SQL(privilege) for privilege in grant.privileges)
        yield sql.SQL("GRANT {} ON TABLE {} TO {}").format(privileges, table, role)
    if grant.readable_columns:
        yield sql.SQL("GRANT SELECT ({}) ON TABLE {} TO {}").format(
            columns(grant.readable_columns), table, role
        )
    if grant.writable_columns:
        yield sql.SQL("GRANT UPDATE ({}) ON TABLE {} TO {}").format(
            columns(grant.writable_columns), table, role
        )


def grant_runtime_privileges(setup: Setup) -> None:
    """Run after the migrations, so that the tables they create exist.

    Only the tables named above are granted: a table added later (the admin panel's users, say) stays
    closed to both accounts until someone decides otherwise.
    """
    with connect(setup.admin_url) as conn:
        for account, grants in ((setup.app, APP_GRANTS), (setup.retention, RETENTION_GRANTS)):
            role = sql.Identifier(account.role)
            # Start from nothing, so a wider grant (an earlier version of this job, or by hand) is withdrawn.
            conn.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA {} FROM {}").format(SCHEMA, role))
            for grant in grants:
                for statement in grant_statements(role, grant):
                    conn.execute(statement)


def bootstrap(admin_url: URL, owner_url: URL, app_url: URL, retention_url: URL) -> None:
    setup = Setup.validated(admin_url, owner_url, app_url, retention_url)
    provision_accounts(setup)
    run_migrations(setup)
    grant_runtime_privileges(setup)


def main() -> int:
    configure_logging()
    # Alembic's own logging setup (alembic.ini) resets the root level to WARNING once the migrations start.
    logger.setLevel(logging.INFO)
    admin_url = settings.admin_database_url
    owner_url = settings.migration_database_url
    retention_url = settings.retention_database_url
    if admin_url is None or owner_url is None or retention_url is None:
        logger.error(
            "KIDSUP_ADMIN_DATABASE_URL, KIDSUP_MIGRATION_DATABASE_URL and KIDSUP_RETENTION_DATABASE_URL "
            "are required."
        )
        return 2
    try:
        bootstrap(
            make_url(admin_url), make_url(owner_url), make_url(settings.database_url), make_url(retention_url)
        )
    except UnsafeSetupError as error:
        logger.error("refusing to set up the database: %s", error)
        return 2
    logger.info("database accounts, schema and grants are in place")
    return 0


if __name__ == "__main__":
    sys.exit(main())
