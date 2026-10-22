"""Pictures for the landing page (SEC-B-01: an upload is hostile until proven otherwise).

A picture is never stored as it arrived. It is decoded (only PNG, JPEG and WebP, nothing animated,
nothing larger than 16 million pixels), turned the right way up, shrunk to at most 2400 pixels on its
longest side, and encoded again as WebP without its metadata (a photo's EXIF can hold the place where it
was taken). What arrives is data to read, never a file to keep: nothing the sender appended, embedded or
named reaches the site. The file is named by a new id, never by anything the sender wrote.

Decoding one large picture takes a few hundred megabytes, so only one is decoded at a time.
"""

import hashlib
import io
import logging
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from pydantic import JsonValue
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import MediaAsset, SiteContent
from app.panel.content_registry import REGISTRY, FieldKind
from app.panel.errors import InvalidImageError, MediaInUseError, MediaNotFoundError, PublicFileError
from app.panel.principal import Principal
from app.panel.schemas.content import MediaPage, MediaRead
from app.panel.services import audit
from app.panel.services.audit import AuditAction, AuditEvent
from app.panel.services.content import latest_publication
from app.panel.services.snapshots import MEDIA_DIRECTORY, PublicFiles, write_atomically

logger = logging.getLogger(__name__)

ACCEPTED_FORMATS = ("PNG", "JPEG", "WEBP")
MAX_PIXELS = 16_000_000
LONGEST_SIDE = 2400
QUALITY = 85
MAX_PICTURES = 300  # the panel is not a photo archive
_one_decode_at_a_time = threading.Lock()
# The places of the landing page that hold a picture; a picture they name cannot be removed.
PICTURE_KEYS = frozenset(entry.key for entry in REGISTRY.fields if entry.kind is FieldKind.IMAGE)


@dataclass(frozen=True, slots=True)
class Encoded:
    content: bytes
    width: int
    height: int


def encode_again(data: bytes) -> Encoded:
    """The picture as a clean WebP, or `InvalidImageError`. Nothing of the original bytes is kept."""
    try:
        with _one_decode_at_a_time, Image.open(io.BytesIO(data), formats=ACCEPTED_FORMATS) as opened:
            if opened.width * opened.height > MAX_PIXELS:
                raise InvalidImageError(reason="too_many_pixels")
            if getattr(opened, "is_animated", False):
                raise InvalidImageError(reason="animated")
            opened.load()
            upright = ImageOps.exif_transpose(opened)
            mode = "RGBA" if "A" in upright.getbands() or "transparency" in upright.info else "RGB"
            picture = upright.convert(mode)
            picture.thumbnail((LONGEST_SIDE, LONGEST_SIDE))
            output = io.BytesIO()
            picture.save(
                output, format="WEBP", quality=QUALITY, method=4, exif=b"", icc_profile=None, xmp=b""
            )
    except InvalidImageError:
        raise
    except (OSError, SyntaxError, ValueError, EOFError, Image.DecompressionBombError):
        raise InvalidImageError(reason="not_a_picture") from None
    return Encoded(content=output.getvalue(), width=picture.width, height=picture.height)


def to_read(asset: MediaAsset) -> MediaRead:
    return MediaRead(
        id=asset.id,
        url=f"/{MEDIA_DIRECTORY}/{asset.id}.webp",
        width=asset.width,
        height=asset.height,
        byte_size=asset.byte_size,
        created_at=asset.created_at,
    )


def picture_path(files: PublicFiles, asset_id: uuid.UUID) -> Path:
    return files.path(f"{MEDIA_DIRECTORY}/{asset_id}.webp")


def upload_picture(db: Session, principal: Principal, files: PublicFiles, data: bytes) -> MediaRead:
    encoded = encode_again(data)
    digest = hashlib.sha256(encoded.content).hexdigest()
    existing = db.scalars(select(MediaAsset).where(MediaAsset.sha256 == digest)).first()
    if existing is not None:
        # The same picture again is the same picture. If its file is gone (a database restored without the
        # volume), uploading it again is how it comes back.
        if not picture_path(files, existing.id).is_file():
            try:
                write_atomically(picture_path(files, existing.id), encoded.content)
            except OSError:
                logger.exception("a picture could not be written")
                raise PublicFileError from None
        return to_read(existing)
    if (db.scalar(select(func.count()).select_from(MediaAsset)) or 0) >= MAX_PICTURES:
        raise InvalidImageError(reason="too_many_pictures")
    asset = MediaAsset(
        id=uuid.uuid4(),
        sha256=digest,
        width=encoded.width,
        height=encoded.height,
        byte_size=len(encoded.content),
        created_by=principal.admin_id,
    )
    db.add(asset)
    db.flush()
    detail: dict[str, JsonValue] = {
        "bytes": len(encoded.content),
        "width": asset.width,
        "height": asset.height,
    }
    audit.record(db, AuditEvent(principal.actor, AuditAction.MEDIA_UPLOADED, "media", asset.id, detail))
    try:
        write_atomically(picture_path(files, asset.id), encoded.content)
    except OSError:
        db.rollback()
        logger.exception("a picture could not be written")
        raise PublicFileError from None
    db.commit()
    return to_read(asset)


def pictures_in_use(db: Session, asset_id: uuid.UUID) -> bool:
    """Whether the draft or the page that is live names the picture (an older publication does not count)."""
    wanted = str(asset_id)
    draft = db.execute(select(SiteContent.key, SiteContent.value).where(SiteContent.key.in_(PICTURE_KEYS)))
    if any(value == wanted for _, value in draft):
        return True
    publication = latest_publication(db)
    published = (
        publication.content if publication is not None and isinstance(publication.content, dict) else {}
    )
    return any(value == wanted for key, value in published.items() if key in PICTURE_KEYS)


def delete_picture(db: Session, principal: Principal, files: PublicFiles, asset_id: uuid.UUID) -> None:
    """Take a picture off the site for good: its row and its file (a parent may withdraw consent for a photo).

    Refused while the draft or the live page uses it; the page would show a broken picture.
    """
    asset = db.get(MediaAsset, asset_id)
    if asset is None:
        raise MediaNotFoundError
    if pictures_in_use(db, asset_id):
        raise MediaInUseError
    db.execute(delete(MediaAsset).where(MediaAsset.id == asset_id))
    detail: dict[str, JsonValue] = {"bytes": asset.byte_size}
    audit.record(db, AuditEvent(principal.actor, AuditAction.MEDIA_DELETED, "media", asset_id, detail))
    try:
        picture_path(files, asset_id).unlink(missing_ok=True)
    except OSError:
        db.rollback()
        logger.exception("a picture could not be removed")
        raise PublicFileError from None
    db.commit()


def list_pictures(db: Session, limit: int, offset: int) -> MediaPage:
    total = db.scalar(select(func.count()).select_from(MediaAsset)) or 0
    assets = db.scalars(
        select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id).limit(limit).offset(offset)
    ).all()
    return MediaPage(items=[to_read(asset) for asset in assets], total=total, limit=limit, offset=offset)
