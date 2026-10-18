"""Tests run against a real Postgres database, never SQLite (the schema uses Postgres arrays).

Set KIDSUP_TEST_DATABASE_URL to point at another server. The database is created if missing.
"""

import os

import psycopg
import pytest
from sqlalchemy.engine import make_url

TEST_URL = os.environ.get(
    "KIDSUP_TEST_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/kidsup_test"
)
os.environ["KIDSUP_DATABASE_URL"] = TEST_URL


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
            conn.execute(f'CREATE DATABASE "{url.database}"')


_ensure_database()

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings, settings
from app.db import SessionLocal
from app.main import create_app

command.upgrade(Config("alembic.ini"), "head")


def make_settings(**overrides) -> Settings:
    """Settings for one test: the real ones with a few fields changed (and re-validated)."""
    return Settings(**{**settings.model_dump(), **overrides})


@pytest.fixture(autouse=True)
def clean_database() -> None:
    with SessionLocal() as db:
        db.execute(text("TRUNCATE applications CASCADE"))
        db.commit()


@pytest.fixture
def app() -> FastAPI:
    # A high limit so ordinary tests never trip the rate limiter; its own tests lower it.
    return create_app(make_settings(rate_limit_per_minute=10_000))


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)
