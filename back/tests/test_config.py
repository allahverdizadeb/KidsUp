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


def production(**overrides):
    return make_settings(environment="production", database_url=LIMITED_ACCOUNT_URL, **overrides)


def test_a_web_process_in_production_must_be_told_its_hosts_and_origins():
    with pytest.raises(RuntimeError, match="KIDSUP_CORS_ORIGINS, KIDSUP_ALLOWED_HOSTS"):
        production().require_web_settings_in_production(panel=False)
    with pytest.raises(RuntimeError, match="KIDSUP_ALLOWED_HOSTS"):
        production(cors_origins=[]).require_web_settings_in_production(panel=False)
    with pytest.raises(RuntimeError, match="KIDSUP_CORS_ORIGINS"):
        production(allowed_hosts=["back"]).require_web_settings_in_production(panel=False)
    production(cors_origins=[], allowed_hosts=["back"]).require_web_settings_in_production(panel=False)


def test_the_panel_must_also_be_told_the_origin_of_its_pages():
    only_the_api_settings = production(cors_origins=[], allowed_hosts=["panel"])

    only_the_api_settings.require_web_settings_in_production(panel=False)  # the public API is not asked
    with pytest.raises(RuntimeError, match="KIDSUP_PANEL_ALLOWED_ORIGINS"):
        only_the_api_settings.require_web_settings_in_production(panel=True)
    production(
        cors_origins=[], allowed_hosts=["panel"], panel_allowed_origins=["https://admin.kidsup.az"]
    ).require_web_settings_in_production(panel=True)


def test_development_is_not_asked_for_anything():
    make_settings().require_web_settings_in_production(panel=True)


def test_the_public_api_refuses_to_start_in_production_with_the_developers_defaults():
    from app.main import create_app

    with pytest.raises(RuntimeError, match="developer's defaults"):
        create_app(production())


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
