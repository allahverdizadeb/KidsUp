import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.main import create_app
from tests.conftest import make_settings
from tests.test_applications import VALID


def production(**overrides):
    return make_settings(
        environment="production",
        cors_origins=["https://kidsup.az"],
        allowed_hosts=["kidsup.az", "testserver"],
        database_url="postgresql://kidsup_app:throw-away@db:5432/kidsup",  # production refuses the superuser
        **overrides,
    )


def test_security_headers_on_every_response(client):
    responses = (client.get("/health"), client.get("/missing"), client.post("/api/applications", json={}))
    for response in responses:
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "no-referrer"
        assert response.headers["Cache-Control"] == "no-store"
        assert "default-src 'none'" in response.headers["Content-Security-Policy"]
        assert "Strict-Transport-Security" not in response.headers  # plain HTTP in development


def test_hsts_only_in_production():
    response = TestClient(create_app(production())).get("/health")
    assert "max-age=" in response.headers["Strict-Transport-Security"]


def test_docs_available_in_development_but_not_in_production(client):
    assert client.get("/docs").status_code == 200
    assert "Content-Security-Policy" not in client.get("/docs").headers  # the docs UI needs a CDN
    prod = TestClient(create_app(production()))
    assert prod.get("/docs").status_code == 404
    assert prod.get("/openapi.json").status_code == 404


def test_rejects_unknown_host(client):
    assert client.get("/health", headers={"Host": "evil.example.com"}).status_code == 400


def test_cors_allows_only_configured_origins(client):
    ok = client.options(
        "/api/applications",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options(
        "/api/applications",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_oversized_body_is_rejected(client):
    huge = {**VALID, "parent_name": "A" * 20_000}
    assert client.post("/api/applications", json=huge).status_code == 413


def test_body_without_content_length_is_rejected(client):
    def chunks():
        yield b'{"a": 1}'

    assert client.post("/api/applications", content=chunks()).status_code == 411


def test_rate_limit_returns_429_with_retry_after(app):
    limited = TestClient(create_app(make_settings(rate_limit_per_minute=3)))
    statuses = [limited.post("/api/applications", json=VALID).status_code for _ in range(5)]
    assert statuses == [201, 201, 201, 429, 429]
    blocked = limited.post("/api/applications", json=VALID)
    assert blocked.headers["Retry-After"] == "60"
    assert limited.get("/health").status_code == 200  # only the API is limited


def test_rate_limit_hits_are_logged_as_events_without_the_address(caplog):
    limited = TestClient(create_app(make_settings(rate_limit_per_minute=1)))
    with caplog.at_level(logging.WARNING, logger="app.rate_limit"):
        limited.post("/api/applications", json=VALID)
        limited.post("/api/applications", json=VALID)

    assert [record.getMessage() for record in caplog.records] == ["rate limit exceeded"]
    assert "testclient" not in caplog.text  # the TestClient's "address": an IP is personal data (SEC-B-10)


def test_invalid_requests_also_count_towards_the_limit():
    limited = TestClient(create_app(make_settings(rate_limit_per_minute=2)))
    statuses = [limited.post("/api/applications", json={}).status_code for _ in range(3)]
    assert statuses == [422, 422, 429]


def test_in_production_the_api_refuses_to_start_as_a_superuser():
    # The URL the settings hold passes the name check; what the database says about the account does not.
    with pytest.raises(RuntimeError, match="administrative attributes"), TestClient(create_app(production())):
        pass


def test_in_production_the_api_starts_as_the_limited_account(provisioned, monkeypatch):
    monkeypatch.setattr("app.main.engine", create_engine(provisioned.app))

    with TestClient(create_app(production())) as running:
        assert running.get("/health").status_code == 200


def test_in_development_the_superuser_may_be_used_for_convenience():
    with TestClient(create_app(make_settings())) as running:
        assert running.get("/health").status_code == 200


def test_a_trailing_slash_is_not_redirected_to_the_internal_host_name(client):
    # Starlette would answer 307 with a Location built from the Host header nginx forwards ("back:8000").
    response = client.post("/api/applications/", json=VALID, follow_redirects=False)

    assert response.status_code == 404
    assert "location" not in response.headers


def test_production_forbids_wildcards():
    with pytest.raises(ValueError, match="Wildcard"):
        make_settings(environment="production", cors_origins=["*"], allowed_hosts=["kidsup.az"])
    with pytest.raises(ValueError, match="Wildcard"):
        make_settings(environment="production", cors_origins=["https://kidsup.az"], allowed_hosts=["*"])
