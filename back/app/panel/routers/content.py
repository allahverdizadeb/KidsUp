import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.errors import InvalidImageError
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.content import (
    ContentRead,
    ContentUpdate,
    MediaPage,
    MediaRead,
    PublicationRead,
    PublishRequest,
)
from app.panel.security import require
from app.panel.services import content as service
from app.panel.services import media
from app.panel.services.snapshots import PublicFiles
from app.panel.state import get_public_files
from app.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin", tags=["content"], dependencies=[Depends(enforce_rate_limit)])

PICTURE_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})


@router.get("/content", response_model=ContentRead)
def get_content(
    _: Principal = Depends(require(Permission.CONTENT_MANAGE)), db: Session = Depends(get_db)
) -> ContentRead:
    return service.describe(db)


@router.put("/content", response_model=ContentRead)
def save_content(
    data: ContentUpdate,
    principal: Principal = Depends(require(Permission.CONTENT_MANAGE)),
    db: Session = Depends(get_db),
) -> ContentRead:
    return service.save_draft(db, principal, data.values)


@router.post("/content/publications", status_code=status.HTTP_201_CREATED, response_model=PublicationRead)
def publish_content(
    body: PublishRequest | None = None,
    principal: Principal = Depends(require(Permission.CONTENT_MANAGE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> PublicationRead:
    """Publish the whole draft, or (with `keys`) only those places, leaving the rest of it unpublished."""
    return service.publish(db, principal, files, None if body is None else body.keys)


@router.get("/media", response_model=MediaPage)
def list_media(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: Principal = Depends(require(Permission.CONTENT_MANAGE)),
    db: Session = Depends(get_db),
) -> MediaPage:
    return media.list_pictures(db, limit, offset)


@router.post("/media", status_code=status.HTTP_201_CREATED, response_model=MediaRead)
async def upload_media(
    request: Request,
    principal: Principal = Depends(require(Permission.CONTENT_MANAGE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> MediaRead:
    """The picture is the body of the request itself (no form, no file name to trust)."""
    if request.headers.get("content-type", "").split(";")[0].strip().lower() not in PICTURE_TYPES:
        raise InvalidImageError(reason="unsupported_type")
    data = await request.body()
    return await run_in_threadpool(media.upload_picture, db, principal, files, data)


@router.delete("/media/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    asset_id: uuid.UUID,
    principal: Principal = Depends(require(Permission.CONTENT_MANAGE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> None:
    """Remove a picture that no longer belongs on the site (say, a photo whose parent withdrew consent)."""
    media.delete_picture(db, principal, files, asset_id)
