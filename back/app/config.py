from datetime import date
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KIDSUP_")

    environment: Literal["development", "production"] = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    # Host header allow-list. In production list every public host name explicitly.
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]

    # The account this process connects as: for the API, one that can only INSERT (SEC-B-07); the retention job's
    # container puts its own account in the same variable.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kidsup"
    # The schema owner (runs migrations), the superuser (creates the accounts) and the account of the
    # retention job and the operator's commands. Only the one-off `app.bootstrap` job gets these three.
    migration_database_url: str | None = None
    admin_database_url: str | None = None
    retention_database_url: str | None = None

    # Request limits. The application payload is about 1 KiB, so these are generous.
    max_body_bytes: int = 16_384
    rate_limit_per_minute: int = 10

    # Applications that never led to enrolment are deleted after this many days (SEC-B-09). The privacy notice
    # tells parents "12 months" (front/src/content/privacyNotice.ts), so a longer period would break that
    # promise: raising this limit means changing the notice and its version first.
    retention_days: int = Field(default=365, ge=30, le=365)

    # Birth dates outside this range are rejected (same limits as the landing page date input).
    birth_date_min: date = date(2010, 1, 1)
    birth_date_max: date = date(2020, 12, 31)

    @field_validator("database_url", "migration_database_url", "admin_database_url", "retention_database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str | None) -> str | None:
        # Hosting providers hand out "postgres://" or "postgresql://" URLs.
        if url is None:
            return None
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @model_validator(mode="after")
    def reject_wildcards_in_production(self) -> "Settings":
        if self.environment == "production" and ("*" in self.cors_origins or "*" in self.allowed_hosts):
            raise ValueError("Wildcard CORS origins or allowed hosts are forbidden in production.")
        return self

    @model_validator(mode="after")
    def reject_superuser_in_production(self) -> "Settings":
        if self.environment == "production" and make_url(self.database_url).username == "postgres":
            raise ValueError("The postgres superuser must not run the API in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
