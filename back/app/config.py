from datetime import date
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KIDSUP_")

    environment: Literal["development", "production"] = "development"
    cors_origins: list[str] = ["http://localhost:5173"]
    # Host header allow-list. In production list every public host name explicitly.
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/kidsup"

    # Request limits. The application payload is about 1 KiB, so these are generous.
    max_body_bytes: int = 16_384
    rate_limit_per_minute: int = 10

    # Birth dates outside this range are rejected (same limits as the landing page date input).
    birth_date_min: date = date(2010, 1, 1)
    birth_date_max: date = date(2020, 12, 31)

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, url: str) -> str:
        # Hosting providers hand out "postgres://" or "postgresql://" URLs.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @model_validator(mode="after")
    def reject_wildcards_in_production(self) -> "Settings":
        if self.environment == "production" and ("*" in self.cors_origins or "*" in self.allowed_hosts):
            raise ValueError("Wildcard CORS origins or allowed hosts are forbidden in production.")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
