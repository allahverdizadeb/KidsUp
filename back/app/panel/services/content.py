"""The landing page's texts and images: staff save a draft, then publish it (SEC-B-10: both are audited).

The draft is the rows of `site_content` (only what differs from the defaults of the registry).
Publishing copies the whole draft into `site_publications`, which keeps the history, and writes
`site.json`, the file nginx serves to the landing page. The page never reads the database.
"""

import logging

from pydantic import JsonValue
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import AdminUser, MediaAsset, SiteContent, SitePublication
from app.panel.content_registry import REGISTRY, ContentField, FieldKind
from app.panel.content_values import PLACEHOLDER_NAMES, as_published, validate
from app.panel.errors import InvalidContentError, PublicFileError, UnknownContentKeyError
from app.panel.principal import Principal
from app.panel.schemas.content import (
    ContentFieldRead,
    ContentRead,
    ItemFieldRead,
    PublicationRead,
    SectionRead,
)
from app.panel.services import audit
from app.panel.services.audit import AuditAction, AuditEvent
from app.panel.services.snapshots import MEDIA_DIRECTORY, SITE_FILE, PublicFiles, write_if_changed

logger = logging.getLogger(__name__)


def as_mapping(value: JsonValue) -> dict[str, JsonValue]:
    return value if isinstance(value, dict) else {}


def draft_values(db: Session) -> dict[str, JsonValue]:
    return dict(db.execute(select(SiteContent.key, SiteContent.value)).all())


def latest_publication(db: Session) -> SitePublication | None:
    return db.scalars(select(SitePublication).order_by(SitePublication.id.desc()).limit(1)).first()


def read_publication(db: Session, publication: SitePublication | None) -> PublicationRead | None:
    if publication is None:
        return None
    author = db.scalar(select(AdminUser.display_name).where(AdminUser.id == publication.published_by))
    return PublicationRead(version=publication.id, published_at=publication.published_at, published_by=author)


def to_read(field: ContentField, draft: JsonValue, published: JsonValue) -> ContentFieldRead:
    return ContentFieldRead(
        key=field.key,
        section=field.section,
        label=field.label,
        kind=field.kind,
        max_length=field.max_length,
        min_items=field.min_items,
        max_items=field.max_items,
        item=[
            ItemFieldRead(
                name=part.name,
                label=part.label,
                kind=part.kind,
                max_length=part.max_length,
                max_items=part.max_items,
            )
            for part in field.item
        ],
        default=field.default,
        draft=draft,
        published=published,
        changed=draft != published,
    )


def describe(db: Session) -> ContentRead:
    draft = draft_values(db)
    publication = latest_publication(db)
    published = as_mapping(publication.content) if publication else {}
    return ContentRead(
        sections=[SectionRead(id=section.id, label=section.label) for section in REGISTRY.sections],
        fields=[to_read(field, draft.get(field.key), published.get(field.key)) for field in REGISTRY.fields],
        placeholders=sorted(PLACEHOLDER_NAMES),
        has_unpublished_changes=draft != published,
        publication=read_publication(db, publication),
    )


def require_known_pictures(
    db: Session, values: dict[str, JsonValue], files: PublicFiles | None = None
) -> None:
    """An image can only be one that was uploaded: its id must be in the list of pictures.

    When publishing (`files` given) the file must be there too: a database restored without the content volume
    has the rows and not the pictures, and a page that names a missing file would show a broken image.
    """
    for key, value in values.items():
        field = REGISTRY.field(key)
        if field is None or field.kind is not FieldKind.IMAGE or value is None:
            continue
        if db.get(MediaAsset, value) is None:
            raise InvalidContentError(key=key, rule="unknown_image")
        if files is not None and not files.path(f"{MEDIA_DIRECTORY}/{value}.webp").is_file():
            raise InvalidContentError(key=key, rule="missing_image_file")


def save_draft(db: Session, principal: Principal, values: dict[str, JsonValue]) -> ContentRead:
    """Save the draft. Every value is checked first, so a bad one saves nothing; null restores the default."""
    checked: dict[str, JsonValue] = {}
    for key, value in values.items():
        field = REGISTRY.field(key)
        if field is None:
            raise UnknownContentKeyError(key=key[:80])
        checked[key] = None if value is None else validate(field, value)
    require_known_pictures(db, checked)
    for key, value in checked.items():
        if value is None:
            db.execute(delete(SiteContent).where(SiteContent.key == key))
            continue
        row = db.get(SiteContent, key)
        if row is None:
            db.add(SiteContent(key=key, value=value, updated_by=principal.admin_id))
        else:
            row.value = value
            row.updated_by = principal.admin_id
    keys: list[JsonValue] = [*sorted(checked)]
    detail: dict[str, JsonValue] = {"keys": keys}
    audit.record(db, AuditEvent(principal.actor, AuditAction.CONTENT_SAVED, "content", None, detail))
    db.commit()
    return describe(db)


def site_document(publication: SitePublication | None) -> JsonValue:
    """What the landing page reads: the published values, with a picture given as the address of its file."""
    overrides = as_mapping(publication.content) if publication else {}
    content: dict[str, JsonValue] = {}
    for key, value in overrides.items():
        field = REGISTRY.field(key)
        if field is not None:  # a place that was removed from the registry since is ignored
            content[key] = as_published(field, value)
    return {
        "version": publication.id if publication else 0,
        "published_at": publication.published_at.isoformat() if publication else None,
        "content": content,
    }


def write_site_file(db: Session, files: PublicFiles) -> None:
    """Write `site.json` from the newest publication. The caller holds `files.lock`."""
    write_if_changed(files.path(SITE_FILE), site_document(latest_publication(db)))


def publish(db: Session, principal: Principal, files: PublicFiles) -> PublicationRead:
    """Make the draft the live page. Nothing is published if the file cannot be written.

    The file is written and the publication committed while one hold of the lock lasts: the refresh loop,
    which writes the file from the newest *committed* publication, cannot slip in between and lay the old
    page over the new one. If the commit fails after the file was written, the file is put back as the
    database has it.
    """
    draft = draft_values(db)
    require_known_pictures(db, draft, files)
    publication = SitePublication(content=draft, published_by=principal.admin_id)
    db.add(publication)
    db.flush()
    detail: dict[str, JsonValue] = {"version": publication.id, "places": len(draft)}
    audit.record(db, AuditEvent(principal.actor, AuditAction.CONTENT_PUBLISHED, "content", None, detail))
    with files.lock:
        try:
            write_if_changed(files.path(SITE_FILE), site_document(publication))
        except OSError:
            db.rollback()
            logger.exception("the published page content could not be written")
            raise PublicFileError from None
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("the publication could not be saved")
            try:
                write_site_file(db, files)
            except Exception:
                logger.exception("the published page content could not be put back")
            raise
    return PublicationRead(
        version=publication.id, published_at=publication.published_at, published_by=principal.display_name
    )


def refresh_site(db: Session, files: PublicFiles) -> bool:
    """Write the file again from the newest publication (at start-up and by the refresh loop)."""
    try:
        with files.lock:
            write_site_file(db, files)
    except Exception:
        logger.exception("the published page content could not be written")
        return False
    return True
