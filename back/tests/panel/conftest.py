from collections.abc import Callable

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.models import AdminRole
from app.panel.main import create_panel_app
from app.panel.services.secret_box import SecretBox
from tests.conftest import make_settings
from tests.panel.support import BASE_URL, OFFICE, ORIGIN, Browser, FakeClock, Staff, add_staff


@pytest.fixture
def secret_key() -> str:
    return Fernet.generate_key().decode()


@pytest.fixture
def box(secret_key: str) -> SecretBox:
    return SecretBox(secret_key)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def panel_settings(secret_key: str, tmp_path) -> Settings:
    return make_settings(
        panel_secret_key=secret_key,
        panel_content_dir=tmp_path / "content",
        panel_allowed_origins=[ORIGIN],
        # High, so ordinary tests never trip the limiters; their own tests lower them.
        panel_rate_limit_per_minute=100_000,
        panel_login_rate_limit_per_minute=100_000,
    )


@pytest.fixture
def panel_app(panel_settings: Settings, clock: FakeClock) -> FastAPI:
    return create_panel_app(panel_settings, clock)


@pytest.fixture
def panel(panel_app: FastAPI) -> TestClient:
    return TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))


@pytest.fixture
def staff(box: SecretBox) -> Staff:
    return add_staff(box, AdminRole.ADMIN)


@pytest.fixture
def make_staff(box: SecretBox) -> Callable[..., Staff]:
    def make(role: AdminRole = AdminRole.ADMIN, email: str | None = None) -> Staff:
        return add_staff(box, role, email)

    return make


@pytest.fixture
def sign_in_as(
    panel_app: FastAPI, make_staff: Callable[..., Staff], clock: FakeClock
) -> Callable[..., Browser]:
    """A page signed in as a new member of staff with that role, with cookies of its own."""

    def sign_in_as(role: AdminRole = AdminRole.ADMIN) -> Browser:
        return Browser(panel_app, make_staff(role), clock)

    return sign_in_as


@pytest.fixture
def admin(sign_in_as: Callable[..., Browser]) -> Browser:
    return sign_in_as(AdminRole.ADMIN)
