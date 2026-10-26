"""Who has access to the panel: only an admin reads the list, and it holds no secret (SEC-B-04, SEC-B-10)."""

import pytest
from sqlalchemy import select, text

from app.db import SessionLocal
from app.models import AdminRole, AuditEntry

URL = "/api/admin/users"
SHOWN = {"id", "email", "display_name", "role", "is_active", "last_login_at"}


def test_an_admin_sees_everybody_who_has_access_the_oldest_account_first(admin, make_staff):
    viewer = make_staff(AdminRole.VIEWER, "viewer@example.test")
    coordinator = make_staff(AdminRole.COORDINATOR, "coordinator@example.test")

    page = admin.get(URL).json()

    assert page["total"] == 3
    assert [(item["email"], item["role"]) for item in page["items"]] == [
        (admin.staff.email, "admin"),
        (viewer.email, "viewer"),
        (coordinator.email, "coordinator"),
    ]
    assert all(set(item) == SHOWN for item in page["items"])
    assert all(item["is_active"] is True for item in page["items"])


def test_the_last_sign_in_is_shown_and_an_account_that_never_signed_in_has_none(admin, make_staff):
    make_staff(AdminRole.VIEWER, "never@example.test")

    by_email = {item["email"]: item for item in admin.get(URL).json()["items"]}

    assert by_email[admin.staff.email]["last_login_at"] == "2026-11-02T10:00:00Z"
    assert by_email["never@example.test"]["last_login_at"] is None


def test_an_account_that_is_switched_off_is_listed_as_such(admin, make_staff):
    off = make_staff(AdminRole.VIEWER, "off@example.test")
    with SessionLocal() as db:
        db.execute(text("UPDATE admin_users SET is_active = false WHERE id = :id"), {"id": off.id})
        db.commit()

    by_email = {item["email"]: item for item in admin.get(URL).json()["items"]}

    assert by_email["off@example.test"]["is_active"] is False


def test_the_answer_holds_no_password_no_authenticator_secret_and_no_session(admin, make_staff):
    other = make_staff(AdminRole.COORDINATOR)

    text = admin.get(URL).text

    assert "$argon2" not in text
    assert other.secret not in text
    assert "password" not in text
    assert "totp" not in text
    assert "csrf" not in text


@pytest.mark.parametrize("role", [AdminRole.VIEWER, AdminRole.COORDINATOR])
def test_only_an_admin_may_read_the_list_of_staff(sign_in_as, role):
    browser = sign_in_as(role)

    refused = browser.get(URL)

    assert refused.status_code == 403
    assert "@" not in refused.text


def test_reading_the_list_is_audited_with_ids_and_never_names_or_addresses(admin, make_staff):
    other = make_staff(AdminRole.VIEWER, "someone.private@example.test")

    admin.get(URL)

    with SessionLocal() as db:
        (entry,) = db.scalars(select(AuditEntry).where(AuditEntry.action == "staff_listed")).all()
    assert entry.admin_email == admin.staff.email  # who read it
    assert entry.entity_type == "admin"
    detail = entry.detail
    assert isinstance(detail, dict)
    ids = detail["ids"]
    assert isinstance(ids, list)
    assert detail["returned"] == 2
    assert sorted(str(item) for item in ids) == sorted([str(admin.staff.id), str(other.id)])
    assert "someone.private" not in str(detail)


def test_a_refused_read_leaves_no_entry_of_a_list_that_was_not_shown(sign_in_as):
    sign_in_as(AdminRole.VIEWER).get(URL)

    with SessionLocal() as db:
        assert db.scalars(select(AuditEntry).where(AuditEntry.action == "staff_listed")).all() == []


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_the_list_cannot_be_changed_through_the_api(admin, method):
    assert getattr(admin, method)(URL).status_code == 405
