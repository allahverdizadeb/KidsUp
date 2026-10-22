"""Tests run against a real Postgres database, never SQLite (the schema uses Postgres arrays).

Set KIDSUP_TEST_DATABASE_URL to point at another local server. The database is created if missing. It must be
local and its name must end in _test: the suite truncates tables and creates and drops databases and roles.
"""

import os
import secrets
from collections.abc import Iterator

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import URL, make_url

from tests.scratch import (
    APP_ROLE,
    OWNER_ROLE,
    PANEL_ROLE,
    RETENTION_ROLE,
    SCRATCH_DATABASE,
    SERVER,
    TEST_URL,
    Provisioned,
    drop_everything,
    require_throwaway_database,
    url_of,
)

require_throwaway_database(make_url(TEST_URL))
os.environ["KIDSUP_DATABASE_URL"] = TEST_URL
# A shell or back/.env prepared for a real deployment must never make the tests migrate or provision it.
for _name in (
    "KIDSUP_ADMIN_DATABASE_URL",
    "KIDSUP_MIGRATION_DATABASE_URL",
    "KIDSUP_RETENTION_DATABASE_URL",
    "KIDSUP_PANEL_DATABASE_URL",
):
    os.environ.pop(_name, None)


def _ensure_database() -> None:
    url = make_url(TEST_URL)
    with psycopg.connect(
        host=url.host,
        port=url.port,
        user=url.username,
        password=url.password,
        dbname="postgres",
        autocommit=True,
    ) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)).fetchone():
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(str(url.database))))


_ensure_database()

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.bootstrap import bootstrap
from app.config import Settings, settings
from app.db import SessionLocal
from app.main import create_app
from tests.factories import DEFAULT_COURSE_ID, make_course

# back/.env is read by the settings too, so clear what only a real deployment sets.
settings.admin_database_url = None
settings.migration_database_url = None
settings.retention_database_url = None
settings.panel_database_url = None

command.upgrade(Config("alembic.ini"), "head")


def make_settings(**overrides) -> Settings:
    """Settings for one test: the real ones with a few fields changed (and re-validated)."""
    return Settings(_env_file=None, **{**settings.model_dump(), **overrides})


@pytest.fixture(autouse=True)
def clean_database() -> None:
    """Every test starts with no data but one open course (like the programme the landing page advertises)."""
    with SessionLocal() as db:
        # Every application belongs to a course and every note to an application, so this empties them too.
        db.execute(
            text("TRUNCATE courses, admin_users, site_content, site_publications, media_assets CASCADE")
        )
        # The audit log refuses TRUNCATE (it is append-only); a superuser can switch that trigger off for the
        # length of this transaction, which is what the tests need and nobody else has.
        db.execute(text("SET LOCAL session_replication_role = replica"))
        db.execute(text("TRUNCATE audit_log"))
        db.commit()
    with SessionLocal() as db:
        db.add(make_course(id=DEFAULT_COURSE_ID))
        db.commit()


@pytest.fixture
def app() -> FastAPI:
    # A high limit so ordinary tests never trip the rate limiter; its own tests lower it.
    return create_app(make_settings(rate_limit_per_minute=10_000))


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def scratch_database() -> Iterator[URL]:
    """An empty database next to the test one, and no leftover accounts. Dropped again afterwards."""
    drop_everything()
    with psycopg.connect(
        host=SERVER.host,
        port=SERVER.port,
        user=SERVER.username,
        password=SERVER.password,
        dbname=SERVER.database,
        autocommit=True,
    ) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(SCRATCH_DATABASE)))
    yield url_of()
    drop_everything()


@pytest.fixture
def owner_url() -> URL:
    return url_of(OWNER_ROLE, secrets.token_hex(12))


@pytest.fixture
def app_url() -> URL:
    return url_of(APP_ROLE, secrets.token_hex(12))


@pytest.fixture
def retention_url() -> URL:
    return url_of(RETENTION_ROLE, secrets.token_hex(12))


@pytest.fixture
def panel_url() -> URL:
    return url_of(PANEL_ROLE, secrets.token_hex(12))


@pytest.fixture
def provisioned(
    scratch_database: URL, owner_url: URL, app_url: URL, retention_url: URL, panel_url: URL
) -> Provisioned:
    """The scratch database after `bootstrap`: migrated, with the four limited accounts and their grants."""
    bootstrap(scratch_database, owner_url, app_url, retention_url, panel_url)
    return Provisioned(scratch_database, owner_url, app_url, retention_url, panel_url)
