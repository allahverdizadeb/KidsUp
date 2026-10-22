import re
import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.orm import Session

from app.models import Application, ApplicationStatus

# A phone number is matched on its last nine digits: what remains of an Azerbaijani number once the country
# code (+994) or the trunk prefix (0) is left out. "050 123 45 67" and "+994 50 123 45 67" are one subscriber.
SIGNIFICANT_DIGITS = 9


def is_expired(now: datetime, retention_days: int) -> ColumnElement[bool]:
    cutoff = now - timedelta(days=retention_days)
    return (Application.status != ApplicationStatus.APPROVED.value) & (Application.created_at < cutoff)


def count_expired_applications(db: Session, now: datetime, retention_days: int) -> int:
    """How many applications `delete_expired_applications` would delete. Changes nothing."""
    count = db.scalar(select(func.count()).select_from(Application).where(is_expired(now, retention_days)))
    return count or 0


def delete_expired_applications(db: Session, now: datetime, retention_days: int) -> int:
    """Delete applications that never led to enrolment and are older than the retention period (SEC-B-09).

    Everything except an approved application is deleted (new, contacted and declined ones alike): records of
    approved families follow the programme's own retention rules. The children and the staff's notes are
    removed with them by the foreign keys' ON DELETE CASCADE.
    """
    deleted = db.execute(
        delete(Application).where(is_expired(now, retention_days)).returning(Application.id)
    ).all()
    db.commit()
    return len(deleted)


def erase_application(db: Session, application_id: uuid.UUID) -> bool:
    """Really delete one application and its children, at a parent's request (SEC-B-09)."""
    return erase_applications(db, [application_id]) == 1


def significant_digits(phone: str) -> str:
    digits = re.sub(r"[^0-9]", "", phone)
    if len(digits) < SIGNIFICANT_DIGITS:
        raise ValueError(f"A phone number has at least {SIGNIFICANT_DIGITS} digits.")
    return digits[-SIGNIFICANT_DIGITS:]


def find_applications_by_phone(db: Session, phone: str) -> list[tuple[uuid.UUID, datetime]]:
    """The id and creation time of every application with this phone number, however it was formatted.

    The operator looks at this list before anything is erased. Names never leave the database.
    """
    stored_digits = func.regexp_replace(Application.phone, "[^0-9]", "", "g")
    rows = db.execute(
        select(Application.id, Application.created_at)
        .where(func.right(stored_digits, SIGNIFICANT_DIGITS) == significant_digits(phone))
        .order_by(Application.created_at)
    ).all()
    return [(row.id, row.created_at) for row in rows]


def erase_applications(db: Session, application_ids: Sequence[uuid.UUID]) -> int:
    """Really delete these applications and their children, at a parent's request (SEC-B-09)."""
    deleted = db.execute(
        delete(Application).where(Application.id.in_(application_ids)).returning(Application.id)
    ).all()
    db.commit()
    return len(deleted)
