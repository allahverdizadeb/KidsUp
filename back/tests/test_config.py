import pytest

from tests.conftest import make_settings

LIMITED_ACCOUNT_URL = "postgresql://kidsup_app:throw-away@db:5432/kidsup"


def test_hosting_provider_urls_are_normalised_to_psycopg():
    assert (
        make_settings(database_url="postgres://u:p@h:5432/d").database_url
        == "postgresql+psycopg://u:p@h:5432/d"
    )
    assert make_settings(database_url="postgresql://u:p@h/d").database_url == "postgresql+psycopg://u:p@h/d"


def test_explicit_driver_is_left_alone():
    url = "postgresql+psycopg://u:p@h/d?sslmode=require"
    assert make_settings(database_url=url).database_url == url


def test_the_privileged_urls_are_optional_and_normalised_like_the_main_one():
    assert make_settings().migration_database_url is None
    assert make_settings().admin_database_url is None
    settings = make_settings(migration_database_url="postgres://owner:p@h/d", admin_database_url=None)
    assert settings.migration_database_url == "postgresql+psycopg://owner:p@h/d"


def test_is_production_flag():
    assert make_settings().is_production is False
    prod = make_settings(
        environment="production",
        cors_origins=["https://k.az"],
        allowed_hosts=["k.az"],
        database_url=LIMITED_ACCOUNT_URL,
    )
    assert prod.is_production


def test_production_refuses_the_postgres_superuser():
    with pytest.raises(ValueError, match="superuser"):
        make_settings(
            environment="production",
            cors_origins=["https://k.az"],
            allowed_hosts=["k.az"],
            database_url="postgresql://postgres:postgres@db:5432/kidsup",
        )


def test_development_may_use_the_superuser_for_convenience():
    assert make_settings(database_url="postgresql://postgres:postgres@localhost/kidsup").database_url
