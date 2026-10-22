"""Helpers for the panel's tests: a movable clock, staff with a working second factor, sign-in."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pyotp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import AdminRole
from app.panel.principal import Principal
from app.panel.security import CSRF_HEADER
from app.panel.services import auth, totp
from app.panel.services.audit import Actor
from app.panel.services.secret_box import SecretBox

# One of the origins the panel's pages are served from (panel_allowed_origins in the fixtures).
ORIGIN = "https://admin.example.test"
PASSWORD = "correct horse battery staple"  # obviously fake, and long enough for the rules
START = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)
SIGN_IN_URL = "/api/admin/sessions"
NO_ONE = Actor(admin_id=None, email=None, network=None)
BASE_URL = "https://testserver"  # the panel's cookie is `Secure`, so the test client talks https
OFFICE = "203.0.113.7"  # documentation address: the audit log keeps only 203.0.113.0/24


class FakeClock:
    def __init__(self, now: datetime = START) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@dataclass
class Staff:
    id: uuid.UUID
    email: str
    role: str
    password: str
    secret: str
    last_step: int | None = None


def add_staff(
    box: SecretBox,
    role: AdminRole = AdminRole.ADMIN,
    email: str | None = None,
    password: str = PASSWORD,
    sessions: Callable[[], Session] = SessionLocal,
) -> Staff:
    secret = totp.new_secret()
    email = email or f"{role.value}-{uuid.uuid4().hex[:6]}@example.test"
    new = auth.NewAdmin(
        email=email, display_name="Test Staff", role=role, password=password, totp_secret=secret
    )
    with sessions() as db:
        admin = auth.create_admin(db, new, box, NO_ONE)
        return Staff(id=admin.id, email=admin.email, role=role.value, password=password, secret=secret)


def principal_of(staff: Staff) -> Principal:
    """The signed-in member of staff as the services see them, for a test that calls a service directly."""
    return Principal(
        admin_id=staff.id,
        email=staff.email,
        display_name="Test Staff",
        role=staff.role,
        session_id=uuid.uuid4(),
        csrf_token="x",
        network=None,
    )


def code_for(staff: Staff, clock: FakeClock) -> str:
    """The code to type now. A code works once, so if its step was used the clock moves to the next."""
    step = totp.step_of(clock())
    if staff.last_step is not None and step <= staff.last_step:
        clock.advance(seconds=totp.STEP_SECONDS * (staff.last_step - step + 1))
        step = totp.step_of(clock())
    staff.last_step = step
    return pyotp.TOTP(staff.secret).at(step * totp.STEP_SECONDS)


def sign_in(
    client: httpx.Client,
    staff: Staff,
    clock: FakeClock,
    *,
    password: str | None = None,
    code: str | None = None,
    origin: str | None = ORIGIN,
) -> httpx.Response:
    headers = {} if origin is None else {"Origin": origin}
    body = {
        "email": staff.email,
        "password": staff.password if password is None else password,
        "code": code_for(staff, clock) if code is None else code,
    }
    return client.post(SIGN_IN_URL, json=body, headers=headers)


def signed_in(client: httpx.Client, staff: Staff, clock: FakeClock) -> dict[str, str]:
    """Signs in and returns the headers a page sends with a request that changes something."""
    response = sign_in(client, staff, clock)
    assert response.status_code == 201, response.text
    return {CSRF_HEADER: response.json()["csrf_token"], "Origin": ORIGIN}


class Browser:
    """A signed-in page: its own cookies, and the headers it sends with a request that changes something."""

    def __init__(self, app: FastAPI, staff: Staff, clock: FakeClock) -> None:
        self.client = TestClient(app, base_url=BASE_URL, client=(OFFICE, 50000))
        self.staff = staff
        self.headers = signed_in(self.client, staff, clock)

    def send(self, method: str, url: str, **options: Any) -> httpx.Response:
        """A request with the page's headers (more headers in `options` are added to them)."""
        headers = {**self.headers, **options.pop("headers", {})}
        response: httpx.Response = self.client.request(method, url, headers=headers, **options)
        return response

    def get(self, url: str, **options: Any) -> httpx.Response:
        response: httpx.Response = self.client.get(url, **options)
        return response

    def post(self, url: str, **options: Any) -> httpx.Response:
        return self.send("POST", url, **options)

    def put(self, url: str, **options: Any) -> httpx.Response:
        return self.send("PUT", url, **options)

    def patch(self, url: str, **options: Any) -> httpx.Response:
        return self.send("PATCH", url, **options)

    def delete(self, url: str, **options: Any) -> httpx.Response:
        return self.send("DELETE", url, **options)
