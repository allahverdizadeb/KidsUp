"""What the operator does to the admin accounts (the panel's own API has no way to create or change them).

Every change to an account that could lock someone out or let someone in ends all of its sessions
(SEC-B-03: tokens are rotated when privileges change) and is written to the audit log.
"""

from datetime import datetime

from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdminRole, AdminUser
from app.panel.errors import PanelError
from app.panel.services import audit, passwords, sessions
from app.panel.services.audit import Actor, AuditAction, AuditEvent
from app.panel.services.secret_box import SecretBox

OPERATOR = Actor(admin_id=None, email="operator", network=None)


class NoSuchAdminError(PanelError):
    """No account with that e-mail address."""


def find(db: Session, email: str) -> AdminUser:
    admin = db.scalars(select(AdminUser).where(AdminUser.email == email.strip().lower())).one_or_none()
    if admin is None:
        raise NoSuchAdminError
    return admin


def list_admins(db: Session) -> list[AdminUser]:
    return list(db.scalars(select(AdminUser).order_by(AdminUser.email)).all())


def record_change(db: Session, admin: AdminUser, what: str) -> None:
    detail: dict[str, JsonValue] = {"change": what}
    audit.record(db, AuditEvent(OPERATOR, AuditAction.ADMIN_CHANGED, "admin", admin.id, detail))


def reset_password(db: Session, email: str, new_password: str, now: datetime) -> None:
    admin = find(db, email)
    passwords.require_acceptable_password(new_password, admin.email)
    admin.password_hash = passwords.hash_password(new_password)
    admin.password_changed_at = now
    admin.failed_logins = 0
    admin.locked_until = None
    sessions.revoke_all_sessions(db, admin.id, now)
    record_change(db, admin, "password_reset")
    db.commit()


def reset_second_factor(db: Session, email: str, secret: str, box: SecretBox, now: datetime) -> None:
    admin = find(db, email)
    admin.totp_secret = box.encrypt(secret)
    admin.last_totp_step = None
    sessions.revoke_all_sessions(db, admin.id, now)
    record_change(db, admin, "second_factor_reset")
    db.commit()


def set_role(db: Session, email: str, role: AdminRole, now: datetime) -> None:
    admin = find(db, email)
    admin.role = role.value
    sessions.revoke_all_sessions(db, admin.id, now)
    record_change(db, admin, f"role_{role.value}")
    db.commit()


def set_active(db: Session, email: str, *, active: bool, now: datetime) -> None:
    admin = find(db, email)
    admin.is_active = active
    if not active:
        sessions.revoke_all_sessions(db, admin.id, now)
    record_change(db, admin, "activated" if active else "deactivated")
    db.commit()


def unlock(db: Session, email: str) -> None:
    admin = find(db, email)
    admin.failed_logins = 0
    admin.locked_until = None
    record_change(db, admin, "unlocked")
    db.commit()
