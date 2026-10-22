"""Signing in and out of the admin panel, and the accounts behind it (SEC-B-03).

Every way a sign-in can fail (no such account, wrong password, wrong or reused code, a locked or switched-off
account) ends in the same `InvalidCredentialsError`, and the password and the code are always both checked, so
neither the answer nor the time it takes says which part was wrong. What really happened goes to
the audit log.
After the fifth wrong attempt the account is locked for a time that doubles with each further attempt, up to a
quarter of an hour; attempts made while it is locked do not lengthen the lock.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from pydantic import JsonValue
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.models import AdminRole, AdminUser
from app.panel.errors import InvalidCredentialsError, WrongPasswordError
from app.panel.principal import Principal
from app.panel.services import audit, passwords, sessions, totp
from app.panel.services.audit import Actor, AuditAction, AuditEvent
from app.panel.services.secret_box import SecretBox

logger = logging.getLogger(__name__)

FREE_FAILURES = 4  # the fifth wrong attempt locks the account
LONGEST_LOCK = timedelta(minutes=15)
FAILURES_KEPT = 100  # the counter stops here, far past any lock
COUNTED_REASONS = ("wrong_password", "wrong_code")  # the others (unknown, locked, switched off) are not


@dataclass(frozen=True, slots=True)
class Credentials:
    email: str
    password: str
    code: str


@dataclass(frozen=True, slots=True)
class SignInContext:
    now: datetime
    network: str | None
    box: SecretBox
    times: sessions.SessionTimes


@dataclass(frozen=True, slots=True)
class SignedIn:
    token: str
    csrf_token: str
    admin: AdminUser


def lock_duration(failures: int) -> timedelta | None:
    """None up to the fourth failure; then a minute, doubling with each further failure, up to the limit."""
    if failures <= FREE_FAILURES:
        return None
    doublings = min(failures - FREE_FAILURES - 1, 6)  # 2**6 minutes is far past the limit already
    return min(timedelta(minutes=2**doublings), LONGEST_LOCK)


def find_admin(db: Session, email: str) -> AdminUser | None:
    return db.scalars(select(AdminUser).where(AdminUser.email == email.strip().lower())).one_or_none()


def why_sign_in_fails(
    admin: AdminUser | None, password_ok: bool, step: int | None, now: datetime
) -> str | None:
    """The real reason, for the audit log only. None means the sign-in is good."""
    if admin is None:
        return "unknown_account"
    if not admin.is_active:
        return "inactive"
    if admin.locked_until is not None and admin.locked_until > now:
        return "locked"
    if not password_ok:
        return "wrong_password"
    if step is None:
        return "wrong_code"
    return None


def count_failure(db: Session, admin_id: uuid.UUID, now: datetime) -> bool:
    """Add one to the account's wrong attempts and lock it if it is time. True when it is now locked.

    One statement counts, so attempts that arrive together are all counted.
    """
    failures = db.scalar(
        update(AdminUser)
        .where(AdminUser.id == admin_id)
        .values(failed_logins=func.least(AdminUser.failed_logins + 1, FAILURES_KEPT))
        .returning(AdminUser.failed_logins)
    )
    lock = lock_duration(failures or 0)
    if lock is not None:
        db.execute(update(AdminUser).where(AdminUser.id == admin_id).values(locked_until=now + lock))
        logger.warning("admin account locked after repeated sign-in failures")
    return lock is not None


def register_failure(db: Session, admin: AdminUser | None, reason: str, context: SignInContext) -> None:
    """Count the failure, lock the account if it is time, write it down, and make it permanent."""
    detail: dict[str, JsonValue] = {"reason": reason}
    if admin is not None and reason in COUNTED_REASONS:
        detail["locked"] = count_failure(db, admin.id, context.now)  # did this one lock the account?
    actor = Actor(
        admin_id=admin.id if admin else None, email=admin.email if admin else None, network=context.network
    )
    audit.record(db, AuditEvent(actor, AuditAction.SIGN_IN_FAILED, "admin", None, detail))
    db.commit()
    logger.warning("sign-in failed")


def claim_sign_in(db: Session, admin: AdminUser, step: int, now: datetime) -> bool:
    """Take the sign-in for good, but only if the account is still what the checks saw (SEC-B-03).

    The checks run on a copy of the row read before the (slow) password check. One statement decides again:
    the code's step is newer than the last one used, the account is not locked and not switched off. So two
    requests that carry the same code cannot both sign in, and a burst of guesses that was already past the
    lock test when the fifth failure was written cannot slip a right guess through a locked account.
    """
    claimed = db.execute(
        update(AdminUser)
        .where(
            AdminUser.id == admin.id,
            AdminUser.is_active.is_(True),
            or_(AdminUser.locked_until.is_(None), AdminUser.locked_until <= now),
            or_(AdminUser.last_totp_step.is_(None), AdminUser.last_totp_step < step),
        )
        .values(failed_logins=0, locked_until=None, last_login_at=now, last_totp_step=step)
        .returning(AdminUser.id)
        .execution_options(synchronize_session=False)
    ).first()
    return claimed is not None


def sign_in(db: Session, credentials: Credentials, context: SignInContext) -> SignedIn:
    admin = find_admin(db, credentials.email)
    # Both factors are always checked, whatever the first answer is (an account that does not exist gets
    # a made-up hash and a made-up secret to check against).
    password_ok = passwords.verify_password(
        admin.password_hash if admin else passwords.DUMMY_HASH, credentials.password
    )
    secret = context.box.decrypt(admin.totp_secret) if admin else None
    step = totp.matching_step(secret, credentials.code, context.now, admin.last_totp_step if admin else None)

    reason = why_sign_in_fails(admin, password_ok, step, context.now)
    if (
        reason is None
        and admin is not None
        and step is not None
        and not claim_sign_in(db, admin, step, context.now)
    ):
        # Another request got there first (the same code, or a lock a moment ago): what it left is the answer.
        db.refresh(admin)
        reason = why_sign_in_fails(admin, password_ok, step, context.now) or "wrong_code"
    if reason is not None or admin is None or step is None:
        register_failure(db, admin, reason or "unknown_account", context)
        raise InvalidCredentialsError

    if passwords.needs_rehash(admin.password_hash):
        admin.password_hash = passwords.hash_password(credentials.password)
    token, csrf_token = sessions.open_session(db, admin, context.now, context.times)
    audit.record(
        db, AuditEvent(Actor(admin.id, admin.email, context.network), AuditAction.SIGN_IN, "admin", admin.id)
    )
    db.commit()
    return SignedIn(token=token, csrf_token=csrf_token, admin=admin)


def sign_out(db: Session, actor: Actor, session_id: uuid.UUID, now: datetime) -> None:
    sessions.revoke_session(db, session_id, now)
    audit.record(db, AuditEvent(actor, AuditAction.SIGN_OUT, "admin", actor.admin_id))
    db.commit()


@dataclass(frozen=True, slots=True)
class PasswordChange:
    current: str
    new: str


def refuse_wrong_current_password(db: Session, principal: Principal, now: datetime) -> None:
    """A wrong current password counts like a wrong password at sign-in (SEC-B-03).

    Whoever holds a session's cookie (an unlocked workstation, a stolen cookie) must not be able to guess the
    password here without limit. The count and the lock are the sign-in's own; when the account gets locked,
    every session of it ends, this one included, so the guessing stops with the lock.
    """
    locked = count_failure(db, principal.admin_id, now)
    if locked:
        sessions.revoke_all_sessions(db, principal.admin_id, now)
    audit.record(
        db,
        AuditEvent(
            principal.actor,
            AuditAction.PASSWORD_CHANGE_FAILED,
            "admin",
            principal.admin_id,
            {"locked": locked},
        ),
    )
    db.commit()


def change_password(db: Session, principal: Principal, change: PasswordChange, now: datetime) -> None:
    """A new password for the signed-in account. Its other sessions end (SEC-B-03: rotate on change)."""
    admin = db.get(AdminUser, principal.admin_id)
    if admin is None or not passwords.verify_password(admin.password_hash, change.current):
        refuse_wrong_current_password(db, principal, now)
        raise WrongPasswordError
    passwords.require_acceptable_password(change.new, admin.email)
    admin.password_hash = passwords.hash_password(change.new)
    admin.password_changed_at = now
    sessions.revoke_all_sessions(db, admin.id, now, keep=principal.session_id)
    audit.record(db, AuditEvent(principal.actor, AuditAction.PASSWORD_CHANGED, "admin", admin.id))
    db.commit()


@dataclass(frozen=True, slots=True)
class NewAdmin:
    email: str
    display_name: str
    role: AdminRole
    password: str
    totp_secret: str


def create_admin(db: Session, new: NewAdmin, box: SecretBox, operator: Actor) -> AdminUser:
    """A new account. Used by the operator's command, which has already shown the secret to the person."""
    email = new.email.strip().lower()
    passwords.require_acceptable_password(new.password, email)
    admin = AdminUser(
        email=email,
        display_name=new.display_name.strip(),
        role=new.role.value,
        password_hash=passwords.hash_password(new.password),
        totp_secret=box.encrypt(new.totp_secret),
    )
    db.add(admin)
    db.flush()
    audit.record(
        db, AuditEvent(operator, AuditAction.ADMIN_CREATED, "admin", admin.id, {"role": new.role.value})
    )
    db.commit()
    return admin
