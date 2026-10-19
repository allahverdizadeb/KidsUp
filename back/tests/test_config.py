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
    assert make_settings().retention_database_url is None
    settings = make_settings(
        migration_database_url="postgres://owner:p@h/d",
        retention_database_url="postgres://retention:p@h/d",
    )
    assert settings.migration_database_url == "postgresql+psycopg://owner:p@h/d"
    assert settings.retention_database_url == "postgresql+psycopg://retention:p@h/d"


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
    url = "postgresql://postgres:postgres@localhost/kidsup"
    assert (
        make_settings(database_url=url).database_url
        == "postgresql+psycopg://postgres:postgres@localhost/kidsup"
    )


@pytest.mark.parametrize("days", [30, 90, 365])
def test_retention_period_accepts_a_month_up_to_the_twelve_months_the_notice_promises(days):
    assert make_settings(retention_days=days).retention_days == days


@pytest.mark.parametrize("days", [-1, 0, 1, 29, 366, 3650, "abc"], ids=repr)
def test_retention_period_refuses_anything_shorter_than_a_month_or_longer_than_the_notice_promises(days):
    with pytest.raises(ValueError, match="retention_days"):
        make_settings(retention_days=days)
