"""Helpers for the tests that provision a throw-away database and its accounts.

Roles live on the whole PostgreSQL server, not in one database, so these helpers only ever touch the fixed
`*_test` names below, and the suite refuses to start unless it is pointed at a local `*_test` database.
"""

import os
from dataclasses import dataclass

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import URL, make_url

TEST_URL = os.environ.get(
    "KIDSUP_TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/kidsup_test"
)
LOCAL_HOSTS = frozenset({None, "localhost", "127.0.0.1", "::1"})

SCRATCH_DATABASE = "kidsup_bootstrap_test"
OWNER_ROLE = "kidsup_owner_test"
APP_ROLE = "kidsup_app_test"
RETENTION_ROLE = "kidsup_retention_test"
PANEL_ROLE = "kidsup_panel_test"
STRANGER_ROLE = "kidsup_stranger_test"
ALL_ROLES = (OWNER_ROLE, APP_ROLE, RETENTION_ROLE, PANEL_ROLE, STRANGER_ROLE)

# The server's superuser on its own `postgres` database: only used to create and drop the names above.
SERVER = make_url(TEST_URL).set(database="postgres")


def require_throwaway_database(url: URL) -> None:
    """The suite creates databases and roles and empties tables: never on a shared or a real database."""
    if url.host not in LOCAL_HOSTS or url.database is None or not url.database.endswith("_test"):
        raise pytest.UsageError(
            "KIDSUP_TEST_DATABASE_URL must name a database on this machine whose name ends in _test "
            "(the tests truncate tables and create and drop databases and roles)."
        )


def url_of(role: str | None = None, password: str | None = None, database: str = SCRATCH_DATABASE) -> URL:
    return SERVER.set(
        database=database, username=role or SERVER.username, password=password or SERVER.password
    )


def drop_everything() -> None:
    with psycopg.connect(
        host=SERVER.host,
        port=SERVER.port,
        user=SERVER.username,
        password=SERVER.password,
        dbname=SERVER.database,
        autocommit=True,
    ) as conn:
        conn.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(SCRATCH_DATABASE))
        )
        for role in ALL_ROLES:
            conn.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(role)))


@dataclass(frozen=True, slots=True)
class Provisioned:
    """A scratch database after `bootstrap`, with the URL of each account."""

    admin: URL
    owner: URL
    app: URL
    retention: URL
    panel: URL
