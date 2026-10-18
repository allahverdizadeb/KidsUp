from tests.conftest import make_settings


def test_hosting_provider_urls_are_normalised_to_psycopg():
    assert (
        make_settings(database_url="postgres://u:p@h:5432/d").database_url
        == "postgresql+psycopg://u:p@h:5432/d"
    )
    assert make_settings(database_url="postgresql://u:p@h/d").database_url == "postgresql+psycopg://u:p@h/d"


def test_explicit_driver_is_left_alone():
    url = "postgresql+psycopg://u:p@h/d?sslmode=require"
    assert make_settings(database_url=url).database_url == url


def test_is_production_flag():
    assert make_settings().is_production is False
    prod = make_settings(environment="production", cors_origins=["https://k.az"], allowed_hosts=["k.az"])
    assert prod.is_production
