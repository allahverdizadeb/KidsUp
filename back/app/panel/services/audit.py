"""The audit log: who did what, when, from which network (SEC-B-10). Append-only, in the database too.

An entry holds ids and states, never a name, a phone number, a note's text or a search term. It is written in
the same transaction as the change it records, so there is no change without its entry.
"""

import uuid
from dataclasses import dataclass
from enum import StrEnum

from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditEntry


class AuditAction(StrEnum):
    SIGN_IN = "sign_in"
    SIGN_IN_FAILED = "sign_in_failed"
    SIGN_OUT = "sign_out"
    PASSWORD_CHANGED = "password_changed"  # noqa: S105  # nosec B105 (an event's name, not a password)
    PASSWORD_CHANGE_FAILED = "password_change_failed"  # noqa: S105  # nosec B105 (an event's name)
    ADMIN_CREATED = "admin_created"
    ADMIN_CHANGED = "admin_changed"
    APPLICATIONS_LISTED = "applications_listed"
    APPLICATION_VIEWED = "application_viewed"
    APPLICATION_STATUS_CHANGED = "application_status_changed"
    APPLICATION_NOTE_ADDED = "application_note_added"
    APPLICATION_NOTE_DELETED = "application_note_deleted"
    APPLICATION_DELETED = "application_deleted"
    APPLICATIONS_EXPORTED = "applications_exported"
    COURSE_CREATED = "course_created"
    COURSE_UPDATED = "course_updated"
    COURSE_DELETED = "course_deleted"
    CONTENT_SAVED = "content_saved"
    CONTENT_PUBLISHED = "content_published"
    MEDIA_UPLOADED = "media_uploaded"
    MEDIA_DELETED = "media_deleted"


@dataclass(frozen=True, slots=True)
class Actor:
    """Who is acting. Empty for a sign-in that failed: nobody has proved who they are."""

    admin_id: uuid.UUID | None
    email: str | None
    network: str | None


@dataclass(frozen=True, slots=True)
class AuditEvent:
    actor: Actor
    action: AuditAction
    entity_type: str | None = None
    entity_id: str | uuid.UUID | None = None
    detail: dict[str, JsonValue] | None = None


def record(db: Session, event: AuditEvent) -> None:
    db.add(
        AuditEntry(
            admin_id=event.actor.admin_id,
            admin_email=event.actor.email,
            action=event.action.value,
            entity_type=event.entity_type,
            entity_id=None if event.entity_id is None else str(event.entity_id),
            detail=event.detail,
            network=event.actor.network,
        )
    )


def list_entries(db: Session, limit: int, offset: int, action: str | None) -> tuple[list[AuditEntry], int]:
    """The newest first, and how many there are in all."""
    query = select(AuditEntry)
    if action is not None:
        query = query.where(AuditEntry.action == action)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    entries = db.scalars(query.order_by(AuditEntry.id.desc()).limit(limit).offset(offset)).all()
    return list(entries), total
