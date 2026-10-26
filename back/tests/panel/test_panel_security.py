"""SEC-B-04, SEC-B-11, SEC-B-12, SEC-B-14 for the admin panel's API: default deny, headers, start-up."""

import asyncio
import logging
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.panel.main import create_panel_app, keep_public_files_fresh
from app.panel.security import SESSION_COOKIE
from app.schemas.application import ApplicationCreate
from app.services import applications as public_service
from tests.conftest import make_settings
from tests.panel.support import BASE_URL, OFFICE, Browser, add_staff
from tests.test_applications import VALID

PUBLIC = {("POST", "/api/admin/sessions"), ("GET", "/health")}
SOME_ID = "00000000-0000-4000-8000-000000000001"


def routes_of(app):
    """Every method and path the application answers, from its own description of itself (OpenAPI)."""
    for path, operations in app.openapi()["paths"].items():
        for method in sorted(operations):
            yield method.upper(), re.sub(r"\{[^}]+\}", SOME_ID, path)


# --- default deny (SEC-B-04)


def test_the_panel_has_routes_to_check(panel_app):
    assert len(list(routes_of(panel_app))) >= 25  # a refactor that loses the routes must not pass silently


def test_every_route_but_the_sign_in_needs_a_session(panel):
    open_to_all = []
    for method, path in routes_of(panel.app):
        if (method, path) in PUBLIC:
            continue
        response = panel.request(method, path, json={} if method in {"POST", "PUT", "PATCH"} else None)
        if response.status_code != 401:
            open_to_all.append((method, path, response.status_code))

    assert open_to_all == []


def test_every_route_but_the_sign_in_refuses_a_cookie_that_names_no_session(panel):
    panel.cookies.set(SESSION_COOKIE, "A" * 43, path="/api/admin")
    wrongly_open = [
        (method, path)
        for method, path in routes_of(panel.app)
        if (method, path) not in PUBLIC and panel.request(method, path, json={}).status_code != 401
    ]

    assert wrongly_open == []


def test_the_public_routes_are_exactly_the_sign_in_and_the_health_check(panel):
    # Adding a public endpoint must be a decision: it has to be added to PUBLIC above, with the reason.
    answers = {
        (method, path): panel.request(method, path, json={}).status_code != 401
        for method, path in routes_of(panel.app)
    }

    assert {route for route, public in answers.items() if public} == PUBLIC


def test_health_reveals_nothing(panel):
    response = panel.get("/health")

    assert (response.status_code, response.json()) == (200, {"status": "ok"})


# --- headers (SEC-B-11) on every response, errors included


@pytest.mark.parametrize(
    ("method", "path", "status"),
    [
        ("GET", "/health", 200),
        ("GET", "/api/admin/sessions/current", 401),
        ("GET", "/nothing/here", 404),
        ("DELETE", "/health", 405),
        ("POST", "/api/admin/sessions", 422),
    ],
)
def test_every_answer_carries_the_security_headers(panel, method, path, status):
    response = panel.request(method, path, json={} if method == "POST" else None)

    assert response.status_code == status
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert "camera=()" in response.headers["permissions-policy"]
    assert "server" not in response.headers


def test_a_page_with_personal_data_is_never_cached(admin):
    response = admin.get("/api/admin/applications/pulse")

    assert response.headers["cache-control"] == "no-store"


def test_an_unexpected_failure_gives_the_visitor_nothing_to_learn_from(panel_app, admin, monkeypatch):
    def explode(*_args, **_kwargs):
        raise RuntimeError("secret internal detail: postgres://user:password@db/kidsup")

    monkeypatch.setattr("app.panel.services.applications.pulse", explode)
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000), raise_server_exceptions=False)
    client.cookies.update(admin.client.cookies)

    response = client.get("/api/admin/applications/pulse")

    assert response.status_code == 500
    assert "secret" not in response.text
    assert "postgres" not in response.text
    assert response.headers["x-content-type-options"] == "nosniff"


def test_a_request_for_another_host_is_refused(panel_settings, clock):
    settings = make_settings(**{**panel_settings.model_dump(), "allowed_hosts": ["panel"]})
    client = TestClient(create_panel_app(settings, clock), base_url="https://panel")

    assert client.get("/health").status_code == 200
    assert client.get("/health", headers={"Host": "evil.example.test"}).status_code == 400


def test_no_other_site_may_read_the_panels_answers_from_a_browser(panel, staff):
    preflight = panel.options(
        "/api/admin/applications/pulse",
        headers={"Origin": "https://evil.example.test", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in preflight.headers
    reply = panel.get("/health", headers={"Origin": "https://evil.example.test"})
    assert "access-control-allow-origin" not in reply.headers


# --- production (SEC-B-14)


@pytest.fixture
def production_settings(panel_settings):
    return make_settings(
        **{
            **panel_settings.model_dump(),
            "environment": "production",
            "database_url": "postgresql+psycopg://kidsup_panel:x@db:5432/kidsup",
            "allowed_hosts": ["panel", "testserver"],
            "cors_origins": [],
        }
    )


def test_in_production_there_are_no_docs_and_there_is_hsts(production_settings, clock):
    client = TestClient(create_panel_app(production_settings, clock), base_url="https://testserver")

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert "max-age" in client.get("/health").headers["strict-transport-security"]


def test_in_development_the_docs_are_there_and_there_is_no_hsts(panel):
    assert panel.get("/docs").status_code == 200
    assert "strict-transport-security" not in panel.get("/health").headers


def test_a_wildcard_origin_is_refused_in_production(panel_settings):
    with pytest.raises(ValueError, match="Wildcard"):
        make_settings(
            **{**panel_settings.model_dump(), "environment": "production", "panel_allowed_origins": ["*"]}
        )


def test_the_panel_does_not_start_without_its_key(panel_settings, clock):
    with pytest.raises(RuntimeError, match="KIDSUP_PANEL_SECRET_KEY"):
        create_panel_app(make_settings(**{**panel_settings.model_dump(), "panel_secret_key": None}), clock)


def test_the_panel_does_not_start_with_a_key_that_is_not_a_key(panel_settings, clock):
    with pytest.raises(ValueError, match="32 url-safe base64-encoded bytes"):
        create_panel_app(make_settings(**{**panel_settings.model_dump(), "panel_secret_key": "short"}), clock)


def test_the_idle_timeout_cannot_be_set_above_fifteen_minutes(panel_settings):
    with pytest.raises(ValueError, match="less than or equal to 15"):
        make_settings(**{**panel_settings.model_dump(), "panel_session_idle_minutes": 16})


@pytest.mark.parametrize("url", ["/api/admin/audit", "/api/admin/courses"])
def test_a_page_number_beyond_what_the_database_can_count_is_a_422_and_not_a_500(admin, url):
    assert admin.get(f"{url}?offset=99999999999999999999").status_code == 422
    assert admin.get(f"{url}?offset=-1").status_code == 422
    assert admin.get(f"{url}?offset=1000000000001").status_code == 422
    assert admin.get(f"{url}?offset=1000").status_code == 200


@pytest.mark.parametrize(
    ("setting", "left_as_in_development"),
    [
        ("allowed_hosts", ["localhost", "127.0.0.1", "testserver"]),
        ("cors_origins", ["http://localhost:5173"]),
        ("panel_allowed_origins", ["http://localhost:5174", "http://127.0.0.1:8081"]),
    ],
)
def test_in_production_the_panel_refuses_to_start_with_the_developers_defaults(
    production_settings, clock, setting, left_as_in_development
):
    forgotten = make_settings(**{**production_settings.model_dump(), setting: left_as_in_development})

    with pytest.raises(RuntimeError, match=f"developer's defaults.*{setting.upper()}"):
        create_panel_app(forgotten, clock)


def test_the_absolute_session_limit_cannot_be_set_above_eight_hours(panel_settings):
    # The documented limit (admin/docs/README.md): a configuration cannot quietly stretch it.
    with pytest.raises(ValueError, match="less than or equal to 8"):
        make_settings(**{**panel_settings.model_dump(), "panel_session_max_hours": 9})


def test_in_production_the_panel_starts_as_its_own_account_and_as_nothing_else(
    provisioned, production_settings, clock, monkeypatch
):
    monkeypatch.setattr("app.panel.main.engine", create_engine(provisioned.panel))
    with TestClient(create_panel_app(production_settings, clock)):  # starting runs the check
        pass

    monkeypatch.setattr("app.panel.main.engine", create_engine(provisioned.app))
    with (
        pytest.raises(RuntimeError, match="not the account it must be"),
        TestClient(create_panel_app(production_settings, clock)),
    ):
        pass


# --- the refresh loop


def test_the_loop_refreshes_every_so_often_and_survives_a_failing_refresh(caplog):
    calls = []

    def refresh() -> None:
        calls.append(1)
        if len(calls) == 2:
            raise OSError("disk full")

    sleeps = []

    async def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        if len(sleeps) == 4:
            raise asyncio.CancelledError

    with caplog.at_level(logging.ERROR), pytest.raises(asyncio.CancelledError):
        asyncio.run(keep_public_files_fresh(refresh, 60, sleep))

    assert sleeps == [60, 60, 60, 60]
    assert len(calls) == 3  # the failing one did not end the loop
    assert "could not be refreshed" in caplog.text


# --- the whole panel with the database account it really has (SEC-B-07)


def test_everything_the_panel_does_works_with_only_the_rights_of_its_database_account(
    provisioned, panel_settings, clock, tmp_path, box
):
    panel_engine = create_engine(provisioned.panel, hide_parameters=True)
    panel_sessions = sessionmaker(bind=panel_engine, expire_on_commit=False)
    api_sessions = sessionmaker(
        bind=create_engine(provisioned.app, hide_parameters=True), expire_on_commit=False
    )
    app = create_panel_app(panel_settings, clock, session_factory=panel_sessions)

    def panel_session():
        with panel_sessions() as db:
            yield db

    app.dependency_overrides[get_db] = panel_session
    staff = add_staff(box, sessions=panel_sessions)  # the account is made by the panel's own database account
    with api_sessions() as db:  # a family applies, with the public API's INSERT-only account
        public_service.create_application(db, ApplicationCreate.model_validate(VALID))

    browser = Browser(app, staff, clock)
    found = browser.post("/api/admin/applications/search", json={"search": "Leyla"}).json()
    application_id = found["items"][0]["id"]
    assert found["total"] == 1
    assert browser.get(f"/api/admin/applications/{application_id}").status_code == 200
    assert (
        browser.patch(f"/api/admin/applications/{application_id}", json={"status": "approved"}).status_code
        == 200
    )
    assert (
        browser.post(f"/api/admin/applications/{application_id}/notes", json={"body": "Called."}).status_code
        == 201
    )
    assert browser.post("/api/admin/applications/export", json={}).status_code == 200
    assert browser.get("/api/admin/dashboard").status_code == 200
    course = browser.get("/api/admin/courses").json()["items"][0]
    assert browser.patch(f"/api/admin/courses/{course['id']}", json={"capacity": 25}).status_code == 200
    ends = browser.patch(f"/api/admin/courses/{course['id']}", json={"end_date": "2027-03-06"})
    assert (ends.status_code, ends.json()["end_date"]) == (200, "2027-03-06")
    assert browser.put("/api/admin/content", json={"values": {"hero.title_first": "Yeni"}}).status_code == 200
    assert browser.post("/api/admin/content/publications").status_code == 201
    assert browser.get("/api/admin/audit").status_code == 200
    assert browser.get("/api/admin/users").json()["total"] == 1
    assert (
        browser.put(
            "/api/admin/account/password",
            json={"current_password": staff.password, "new_password": "yet another long password"},
        ).status_code
        == 204
    )
    assert browser.delete(f"/api/admin/applications/{application_id}?confirm=true").status_code == 204
    assert browser.delete("/api/admin/sessions/current").status_code == 204
    assert (tmp_path / "content" / "site.json").exists()
    assert (tmp_path / "content" / "courses.json").exists()
