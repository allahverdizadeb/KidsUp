import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.courses import CourseCreate, CoursePage, CourseRead, CourseUpdate
from app.panel.security import require
from app.panel.services import courses as service
from app.panel.services import snapshots
from app.panel.services.snapshots import PublicFiles
from app.panel.state import get_public_files
from app.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin/courses", tags=["courses"], dependencies=[Depends(enforce_rate_limit)])


@router.get("", response_model=CoursePage)
def list_courses(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1_000_000),
    _: Principal = Depends(require(Permission.COURSES_READ)),
    db: Session = Depends(get_db),
) -> CoursePage:
    return service.list_courses(db, limit, offset)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CourseRead)
def create_course(
    data: CourseCreate,
    principal: Principal = Depends(require(Permission.COURSES_WRITE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> CourseRead:
    course = service.create_course(db, principal, data)
    snapshots.refresh_courses(db, files)
    return course


@router.get("/{course_id}", response_model=CourseRead)
def get_course(
    course_id: uuid.UUID,
    _: Principal = Depends(require(Permission.COURSES_READ)),
    db: Session = Depends(get_db),
) -> CourseRead:
    return service.get_course(db, course_id)


@router.patch("/{course_id}", response_model=CourseRead)
def update_course(
    course_id: uuid.UUID,
    data: CourseUpdate,
    principal: Principal = Depends(require(Permission.COURSES_WRITE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> CourseRead:
    course = service.update_course(db, principal, course_id, data)
    snapshots.refresh_courses(db, files)
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: uuid.UUID,
    principal: Principal = Depends(require(Permission.COURSES_WRITE)),
    db: Session = Depends(get_db),
    files: PublicFiles = Depends(get_public_files),
) -> Response:
    service.delete_course(db, principal, course_id)
    snapshots.refresh_courses(db, files)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
