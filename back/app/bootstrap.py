"""One-off database setup, run before the API starts (SEC-B-07).

Three accounts keep a compromised API from owning the database:

* admin (the PostgreSQL superuser): used only here, to create the other two accounts and set grants;
* owner: owns the tables and runs the Alembic migrations;
* app: what the API and the retention job connect as. SELECT, INSERT, UPDATE and DELETE only.

Every step is idempotent, so the job runs on every start. It also upgrades a database that was created before
the split: its tables change owner, no row is touched.
"""

import logging
import sys
from dataclasses import dataclass

import psycopg
from alembic.config import Config
from psycopg import sql
from psycopg.rows import TupleRow
from sqlalchemy.engine import URL, make_url

from alembic import command
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_DATABASES = frozenset({"postgres", "template0", "template1"})
SCHEMA = sql.Identifier("public")
MIGRATION_TABLE = sql.Identifier("alembic_version")
ROLE_OPTIONS = sql.SQL("LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS")


@dataclass(frozen=True, slots=True)
class Account:
    role: str
    password: str


def account_of(url: URL) -> Account:
    if not url.username or not url.password:
        raise ValueError("A database URL needs a user name and a password.")
    return Account(role=url.username, password=url.password)


def connect(url: URL) -> psycopg.Connection[TupleRow]:
    return psycopg.connect(
        host=url.host,
        port=url.port,
        user=url.username,
        password=url.password,
        dbname=url.database,
        autocommit=True,
    )


def ensure_role(conn: psycopg.Connection[TupleRow], account: Account) -> None:
    """Create the role, or reset its attributes and password to the configured ones."""
    exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (account.role,)).fetchone()
    conn.execute(
        sql.SQL("{verb} ROLE {role} {options} PASSWORD {password}").format(
            verb=sql.SQL("ALTER" if exists else "CREATE"),
            role=sql.Identifier(account.role),
            options=ROLE_OPTIONS,
            password=sql.Literal(account.password),
        )
    )


def provision_accounts(admin_url: URL, owner: Account, app: Account) -> None:
    if admin_url.database is None:
        raise ValueError("The admin database URL needs a database name.")
    if admin_url.database in SYSTEM_DATABASES:
        # Accounts and privileges are changed for the application's own database, never for the server's.
        raise ValueError("Refusing to change accounts and privileges of a system database.")
    database = sql.Identifier(admin_url.database)
    owner_role = sql.Identifier(owner.role)
    app_role = sql.Identifier(app.role)
    with connect(admin_url) as conn:
        ensure_role(conn, owner)
        ensure_role(conn, app)
        # Nobody else may connect or create objects; each account gets exactly what it needs.
        conn.execute(sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(database))
        conn.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}, {}").format(database, owner_role, app_role))
        conn.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(SCHEMA))
        conn.execute(sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(SCHEMA, app_role))
        conn.execute(sql.SQL("GRANT USAGE, CREATE ON SCHEMA {} TO {}").format(SCHEMA, owner_role))
        # A database created before this split has tables owned by the superuser.
        foreign_tables = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> %s", (owner.role,)
        ).fetchall()
        for (table,) in foreign_tables:
            conn.execute(
                sql.SQL("ALTER TABLE {}.{} OWNER TO {}").format(SCHEMA, sql.Identifier(table), owner_role)
            )


def run_migrations(owner_url: URL) -> None:
    config = Config("alembic.ini")
    # ConfigParser treats "%" specially, and a URL may contain percent-encoded characters.
    config.set_main_option(
        "sqlalchemy.url", owner_url.render_as_string(hide_password=False).replace("%", "%%")
    )
    command.upgrade(config, "head")


def grant_runtime_privileges(admin_url: URL, app: Account) -> None:
    """Run after the migrations so that tables created by them are covered too."""
    app_role = sql.Identifier(app.role)
    with connect(admin_url) as conn:
        conn.execute(
            sql.SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {} TO {}").format(
                SCHEMA, app_role
            )
        )
        # The migration bookkeeping is not the API's business.
        conn.execute(sql.SQL("REVOKE ALL ON TABLE {}.{} FROM {}").format(SCHEMA, MIGRATION_TABLE, app_role))


def bootstrap(admin_url: URL, owner_url: URL, app_url: URL) -> None:
    owner = account_of(owner_url)
    app = account_of(app_url)
    provision_accounts(admin_url, owner, app)
    run_migrations(owner_url)
    grant_runtime_privileges(admin_url, app)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if settings.admin_database_url is None or settings.migration_database_url is None:
        logger.error("KIDSUP_ADMIN_DATABASE_URL and KIDSUP_MIGRATION_DATABASE_URL are required.")
        return 2
    bootstrap(
        make_url(settings.admin_database_url),
        make_url(settings.migration_database_url),
        make_url(settings.database_url),
    )
    logger.info("database accounts, schema and grants are in place")
    return 0


if __name__ == "__main__":
    sys.exit(main())
