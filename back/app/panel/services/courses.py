"""Courses: when a group starts, what it costs, how many children it takes, and whether it takes applications.

The rules that must hold whoever writes the rows (seats, open registration) are in the database
(alembic/versions/0006); this module asks the database for the numbers and turns its refusals into errors.
"""

import uuid
from datetime import date

from pydantic import JsonValue
from sqlalchemy import delete, func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.database_errors import CAPACITY_BELOW_APPROVED, sqlstate_of
from app.models import Application, Course
from app.panel.errors import (
    CapacityBelowApprovedError,
    CourseHasApplicationsError,
    CourseNotFoundError,
    InvalidCourseError,
)
from app.panel.principal import Principal
from app.panel.schemas.courses import (
    CourseCreate,
    CoursePage,
    CourseRead,
    CourseUpdate,
    SeatsRead,
    StatusCounts,
)
from app.panel.services import audit
from app.panel.services.audit import AuditAction, AuditEvent

FOREIGN_KEY_VIOLATION = "23503"
EDITABLE_FIELDS = (
    "title",
    "start_date",
    "end_date",
    "schedule",
    "location",
    "age_min",
    "age_max",
    "price_minor",
    "second_child_price_minor",
    "capacity",
    "registration_open",
)


def status_counts(db: Session, course_ids: list[uuid.UUID]) -> dict[uuid.UUID, StatusCounts]:
    """How many applications each course has, by status."""
    counts: dict[uuid.UUID, StatusCounts] = {course_id: StatusCounts() for course_id in course_ids}
    rows = db.execute(
        select(Application.course_id, Application.status, func.count())
        .where(Application.course_id.in_(course_ids))
        .group_by(Application.course_id, Application.status)
    ).all()
    for course_id, status, count in rows:
        setattr(counts[course_id], status, count)
    return counts


def to_read(course: Course, taken: int, accepting: bool, applications: StatusCounts) -> CourseRead:
    return CourseRead(
        id=course.id,
        title=course.title,
        start_date=course.start_date,
        end_date=course.end_date,
        schedule=course.schedule,
        location=course.location,
        age_min=course.age_min,
        age_max=course.age_max,
        price_minor=course.price_minor,
        second_child_price_minor=course.second_child_price_minor,
        currency=course.currency,
        capacity=course.capacity,
        registration_open=course.registration_open,
        accepting_applications=accepting,
        seats=SeatsRead(
            capacity=course.capacity,
            approved_children=taken,
            free_seats=max(course.capacity - taken, 0),
            applications=applications,
        ),
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def load_courses(
    db: Session, only_open: bool = False, limit: int | None = None, offset: int = 0
) -> list[CourseRead]:
    """Courses with their seats, the newest start date first; the numbers come from the database's rules."""
    query = select(
        Course, func.course_seats_taken(Course.id), func.course_accepts_applications(Course.id)
    ).order_by(Course.start_date.desc(), Course.id)
    if only_open:
        query = query.where(Course.registration_open)
    rows = db.execute(query.limit(limit).offset(offset)).all()
    counts = status_counts(db, [course.id for course, _, _ in rows])
    return [to_read(course, taken, bool(accepting), counts[course.id]) for course, taken, accepting in rows]


def list_courses(db: Session, limit: int, offset: int) -> CoursePage:
    total = db.scalar(select(func.count()).select_from(Course)) or 0
    return CoursePage(
        items=load_courses(db, limit=limit, offset=offset), total=total, limit=limit, offset=offset
    )


def get_course(db: Session, course_id: uuid.UUID) -> CourseRead:
    rows = db.execute(
        select(Course, func.course_seats_taken(Course.id), func.course_accepts_applications(Course.id)).where(
            Course.id == course_id
        )
    ).all()
    if not rows:
        raise CourseNotFoundError
    course, taken, accepting = rows[0]
    return to_read(course, taken, bool(accepting), status_counts(db, [course_id])[course_id])


def jsonable(value: object) -> JsonValue:
    return value.isoformat() if isinstance(value, date) else value  # type: ignore[return-value]  # a str, int or bool otherwise


def create_course(db: Session, principal: Principal, data: CourseCreate) -> CourseRead:
    course = Course(**data.model_dump())
    db.add(course)
    db.flush()
    detail: dict[str, JsonValue] = {"registration_open": course.registration_open}
    audit.record(db, AuditEvent(principal.actor, AuditAction.COURSE_CREATED, "course", course.id, detail))
    db.commit()
    return get_course(db, course.id)


def update_course(db: Session, principal: Principal, course_id: uuid.UUID, data: CourseUpdate) -> CourseRead:
    course = db.get(Course, course_id)
    if course is None:
        raise CourseNotFoundError
    changes: dict[str, JsonValue] = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        before = getattr(course, field)
        clears_end_date = field == "end_date" and value is None  # the one value that may be taken back
        if (value is not None or clears_end_date) and value != before:
            changes[field] = [jsonable(before), jsonable(value)]
            setattr(course, field, value)
    if course.age_min > course.age_max:
        db.rollback()
        raise InvalidCourseError(field="age_max")
    if course.end_date is not None and course.end_date < course.start_date:
        db.rollback()
        raise InvalidCourseError(field="end_date")
    if changes:
        audit.record(
            db,
            AuditEvent(
                principal.actor, AuditAction.COURSE_UPDATED, "course", course_id, {"changes": changes}
            ),
        )
        try:
            db.commit()
        except DBAPIError as error:
            db.rollback()
            if sqlstate_of(error) != CAPACITY_BELOW_APPROVED:
                raise
            raise CapacityBelowApprovedError(
                approved_children=get_course(db, course_id).seats.approved_children
            ) from None
    return get_course(db, course_id)


def delete_course(db: Session, principal: Principal, course_id: uuid.UUID) -> None:
    """Only a course that nobody applied to. One with applications is closed instead."""
    try:
        deleted = db.execute(delete(Course).where(Course.id == course_id).returning(Course.id)).first()
    except DBAPIError as error:
        db.rollback()
        if sqlstate_of(error) != FOREIGN_KEY_VIOLATION:
            raise
        raise CourseHasApplicationsError from None
    if deleted is None:
        raise CourseNotFoundError
    audit.record(db, AuditEvent(principal.actor, AuditAction.COURSE_DELETED, "course", course_id))
    db.commit()
