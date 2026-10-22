from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

# What a developer's machine needs and a production server must never be left with by accident.
DEVELOPER_CORS_ORIGINS = ("http://localhost:5173",)
DEVELOPER_ALLOWED_HOSTS = ("localhost", "127.0.0.1", "testserver")
DEVELOPER_PANEL_ORIGINS = ("http://localhost:5174", "http://127.0.0.1:8081")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KIDSUP_")

    environment: Literal["development", "production"] = "development"
    cors_origins: list[str] = list(DEVELOPER_CORS_ORIGINS)
    # Host header allow-list. In production list every public host name explicitly.
    allowed_hosts: list[str] = list(DEVELOPER_ALLOWED_HOSTS)

    # The account this process connects as: for the public API, one that can only INSERT (SEC-B-07); the
    # retention job's and the admin panel's containers put their own account in the same variable.
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kidsup"
    # The schema owner (runs migrations), the superuser (creates the accounts) and the accounts of the
    # retention job and of the admin panel. Only the one-off `app.bootstrap` job gets these four.
    migration_database_url: str | None = None
    admin_database_url: str | None = None
    retention_database_url: str | None = None
    panel_database_url: str | None = None

    # Request limits. The application payload is about 1 KiB, so these are generous.
    max_body_bytes: int = 16_384
    rate_limit_per_minute: int = 10

    # Applications that were not approved are deleted after this many days (SEC-B-09). The privacy notice
    # tells parents "12 months" (front/src/content/privacyNotice.ts), so a longer period would break that
    # promise: raising this limit means changing the notice and its version first.
    retention_days: int = Field(default=365, ge=30, le=365)

    # Birth dates outside this range are rejected (same limits as the landing page date input).
    birth_date_min: date = date(2010, 1, 1)
    birth_date_max: date = date(2020, 12, 31)

    # --- The admin panel (app/panel). Only its own container gets these.
    # The key that encrypts the one-time-code secrets in the database (a Fernet key: 32 random bytes,
    # URL-safe base64). It is not in the database, so a copy of the database alone does not give them away.
    panel_secret_key: str | None = None
    # The origins the admin panel's pages are served from. A state-changing request from any other origin is
    # refused (CSRF), on top of the SameSite=Strict cookie and the token header.
    panel_allowed_origins: list[str] = list(DEVELOPER_PANEL_ORIGINS)
    # SEC-B-03: a session ends after at most 15 idle minutes, and after the absolute limit however busy.
    panel_session_idle_minutes: int = Field(default=15, ge=1, le=15)
    panel_session_max_hours: int = Field(default=8, ge=1, le=8)
    # Sign-in attempts per minute and client address, on top of the per-account backoff.
    panel_login_rate_limit_per_minute: int = Field(default=10, ge=1)
    panel_rate_limit_per_minute: int = Field(default=600, ge=1)
    panel_max_body_bytes: int = 65_536
    panel_max_image_bytes: int = 5 * 1024 * 1024
    # Where the published landing page content and the uploaded images are written. nginx serves it to the
    # public site read-only, so the public site never reads the database.
    panel_content_dir: Path = Path("/srv/content")
    # How often the published list of open courses is refreshed on its own (seconds), so a change made outside
    # the panel (an erasure by the operator, say) reaches the landing page too.
    panel_refresh_seconds: int = Field(default=60, ge=5)

    @field_validator(
        "database_url",
        "migration_database_url",
        "admin_database_url",
        "retention_database_url",
        "panel_database_url",
    )
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
        wildcards = "*" in self.cors_origins or "*" in self.allowed_hosts or "*" in self.panel_allowed_origins
        if self.environment == "production" and wildcards:
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

    def require_web_settings_in_production(self, *, panel: bool) -> None:
        """A web process in production is told its hosts and origins; the developer's defaults are refused.

        Left out by mistake they would let a request through that names `localhost` or a developer's page as
        its origin. Processes that serve no requests (the retention job) are not asked.
        """
        if not self.is_production:
            return
        settings_and_defaults = [
            ("KIDSUP_CORS_ORIGINS", self.cors_origins, DEVELOPER_CORS_ORIGINS),
            ("KIDSUP_ALLOWED_HOSTS", self.allowed_hosts, DEVELOPER_ALLOWED_HOSTS),
        ]
        if panel:
            settings_and_defaults.append(
                ("KIDSUP_PANEL_ALLOWED_ORIGINS", self.panel_allowed_origins, DEVELOPER_PANEL_ORIGINS)
            )
        forgotten = [name for name, value, default in settings_and_defaults if tuple(value) == default]
        if forgotten:
            raise RuntimeError(
                "In production these must be set to the real values, not left as the developer's defaults: "
                + ", ".join(forgotten)
                + "."
            )


settings = Settings()
