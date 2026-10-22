import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.clock import Clock
from app.panel.errors import ConfirmationRequiredError
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.applications import (
    ApplicationFilter,
    ApplicationPage,
    ApplicationRead,
    ApplicationSearch,
    ApplicationUpdate,
    NoteCreate,
    NoteRead,
    Pulse,
)
from app.panel.security import enforce_export_rate_limit, require
from app.panel.services import applications as service
from app.panel.services import csv_export, snapshots
from app.panel.services.snapshots import PublicFiles
from app.panel.state import get_clock, get_public_files
from app.rate_limit import enforce_rate_limit

router = APIRouter(
    prefix="/api/admin/applications", tags=["applications"], dependencies=[Depends(enforce_rate_limit)]
)

CSV_TYPE = "text/csv; charset=utf-8"


@router.post("/search", response_model=ApplicationPage)
def search_applications(
    search: ApplicationSearch,
    principal: Principal = Depends(require(Permission.APPLICATIONS_READ)),
    db: Session = Depends(get_db),
) -> ApplicationPage:
    return service.search_applications(db, principal, search)


@router.get("/pulse", response_model=Pulse)
def pulse(
    _: Principal = Depends(require(Permission.APPLICATIONS_READ)), db: Session = Depends(get_db)
) -> Pulse:
    return service.pulse(db)


@router.post("/export", dependencies=[Depends(enforce_export_rate_limit)])
def export_applications(
    filters: ApplicationFilter,
    principal: Principal = Depends(require(Permission.APPLICATIONS_EXPORT)),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    content = csv_export.export_applications(db, principal, filters)
    filename = f"muracietler-{clock().astimezone(service.BAKU).date().isoformat()}.csv"
    return Response(
        content=content,
        media_type=CSV_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(
    application_id: uuid.UUID,
    principal: Principal = Depends(require(Permission.APPLICATIONS_READ)),
    db: Session = Depends(get_db),
) -> ApplicationRead:
    return service.get_application(db, principal, application_id)


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: uuid.UUID,
    data: ApplicationUpdate,
    principal: Principal = Depends(require(Permission.APPLICATIONS_UPDATE)),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    files: PublicFiles = Depends(get_public_files),
) -> ApplicationRead:
    application = service.change_status(db, principal, application_id, data.status, clock())
    snapshots.refresh_courses(db, files)  # a seat was taken or given back
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def erase_application(
    application_id: uuid.UUID,
    confirm: bool = False,
    principal: Principal = Depends(require(Permission.APPLICATIONS_DELETE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> None:
    if not confirm:
        raise ConfirmationRequiredError
    service.erase_application(db, principal, application_id)
    snapshots.refresh_courses(db, files)  # the seats of an approved application are free again


@router.post("/{application_id}/notes", status_code=status.HTTP_201_CREATED, response_model=NoteRead)
def add_note(
    application_id: uuid.UUID,
    data: NoteCreate,
    principal: Principal = Depends(require(Permission.APPLICATIONS_UPDATE)),
    db: Session = Depends(get_db),
) -> NoteRead:
    return service.add_note(db, principal, application_id, data.body)


@router.delete("/{application_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    application_id: uuid.UUID,
    note_id: uuid.UUID,
    principal: Principal = Depends(require(Permission.APPLICATIONS_DELETE)),
    db: Session = Depends(get_db),
) -> None:
    service.delete_note(db, principal, application_id, note_id)
