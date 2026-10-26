"""Server-side sessions of the admin panel (SEC-B-03).

The cookie holds a random token; the database holds only its SHA-256, so a copy of the table cannot be used to
sign in. A session ends when it is revoked (signing out, a new password), when it has been idle for too long,
or when its absolute lifetime is over, however busy it was.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import AdminSession, AdminUser

TOKEN_BYTES = 32
# Finished sessions are kept for a day (so a "your session ended" is still understood), then removed.
KEEP_FINISHED_FOR = timedelta(days=1)


@dataclass(frozen=True, slots=True)
class SessionTimes:
    idle: timedelta
    lifetime: timedelta


@dataclass(frozen=True, slots=True)
class OpenSession:
    """What a request carries once its cookie has been checked."""

    session_id: uuid.UUID
    csrf_token: str
    admin: AdminUser


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def open_session(db: Session, admin: AdminUser, now: datetime, times: SessionTimes) -> tuple[str, str]:
    """A new session for the account: the token for the cookie and the CSRF token for the page."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    csrf_token = secrets.token_urlsafe(TOKEN_BYTES)
    db.add(
        AdminSession(
            token_hash=hash_token(token),
            admin_id=admin.id,
            csrf_token=csrf_token,
            last_seen_at=now,
            expires_at=now + times.lifetime,
        )
    )
    db.execute(
        delete(AdminSession).where(
            (AdminSession.expires_at < now - KEEP_FINISHED_FOR)
            | (AdminSession.revoked_at < now - KEEP_FINISHED_FOR)
        )
    )
    return token, csrf_token


def find_open_session(db: Session, token: str, now: datetime, times: SessionTimes) -> OpenSession | None:
    """The session behind a cookie, or None if it is unknown, revoked, idle too long, over, or switched off.

    It only looks: that somebody is working in the session is recorded by `touch_session`, once the request
    has passed every check (a request that is refused must not keep a forgotten session alive).
    """
    row = db.execute(
        select(AdminSession, AdminUser)
        .join(AdminUser, AdminUser.id == AdminSession.admin_id)
        .where(AdminSession.token_hash == hash_token(token))
    ).one_or_none()
    if row is None:
        return None
    session, admin = row
    if (
        session.revoked_at is not None
        or session.expires_at <= now
        or now - session.last_seen_at > times.idle
        or not admin.is_active
    ):
        return None
    return OpenSession(session_id=session.id, csrf_token=session.csrf_token, admin=admin)


def touch_session(db: Session, session_id: uuid.UUID, now: datetime) -> None:
    """Somebody is working in this session: its idle time starts again."""
    db.execute(update(AdminSession).where(AdminSession.id == session_id).values(last_seen_at=now))
    db.commit()


def revoke_session(db: Session, session_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        update(AdminSession)
        .where(AdminSession.id == session_id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def revoke_all_sessions(
    db: Session, admin_id: uuid.UUID, now: datetime, keep: uuid.UUID | None = None
) -> None:
    """End every session of an account (a new password, a changed role), except `keep`: the one in use."""
    query = update(AdminSession).where(AdminSession.admin_id == admin_id, AdminSession.revoked_at.is_(None))
    if keep is not None:
        query = query.where(AdminSession.id != keep)
    db.execute(query.values(revoked_at=now))
