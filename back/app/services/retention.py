import re
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, func
from sqlalchemy.orm import Session

from app.models import Application


def delete_expired_applications(db: Session, now: datetime, retention_days: int) -> int:
    """Delete applications that never led to enrolment and are older than the retention period (SEC-B-09).

    Only status "new" is touched: records of enrolled families follow the programme's own retention rules.
    The children are removed with them by the foreign key's ON DELETE CASCADE.
    """
    cutoff = now - timedelta(days=retention_days)
    expired = (
        delete(Application)
        .where(Application.status == "new", Application.created_at < cutoff)
        .returning(Application.id)
    )
    deleted = db.execute(expired).all()
    db.commit()
    return len(deleted)


def erase_application(db: Session, application_id: uuid.UUID) -> bool:
    """Really delete one application and its children, at a parent's request (SEC-B-09)."""
    deleted = db.execute(
        delete(Application).where(Application.id == application_id).returning(Application.id)
    ).all()
    db.commit()
    return bool(deleted)


def erase_applications_by_phone(db: Session, phone: str) -> int:
    """Really delete every application whose phone number has the same digits, at a parent's request."""
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return 0  # an empty number must never match everything
    deleted = db.execute(
        delete(Application)
        .where(func.regexp_replace(Application.phone, r"\D", "", "g") == digits)
        .returning(Application.id)
    ).all()
    db.commit()
    return len(deleted)
