"""Staff work on applications: find, read, change the status, write notes, erase (SEC-B-09, SEC-B-10).

Every read of personal data and every change is written to the audit log in the same transaction. The entry
holds ids, states and counts, never a name, a phone number, a note or the words that were searched for.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone

from pydantic import JsonValue
from sqlalchemy import ColumnElement, any_, delete, exists, func, literal, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import InstrumentedAttribute, Session, joinedload, selectinload
from sqlalchemy.sql.elements import UnaryExpression

from app.database_errors import NOT_ENOUGH_SEATS, sqlstate_of
from app.models import AdminUser, Application, ApplicationNote, ApplicationStatus, Child, Course
from app.panel.errors import (
    ApplicationNotFoundError,
    ApprovalLockedError,
    NoteNotFoundError,
    NotEnoughSeatsError,
    TooManyNotesError,
)
from app.panel.permissions import Permission, has_permission
from app.panel.principal import Principal
from app.panel.schemas.applications import (
    ApplicationFilter,
    ApplicationPage,
    ApplicationRead,
    ApplicationSearch,
    ApplicationSummary,
    ChildRead,
    CourseReference,
    NoteRead,
    Pulse,
)
from app.panel.services import audit
from app.panel.services.audit import AuditAction, AuditEvent
from app.panel.services.text_search import Needle

# Azerbaijan keeps one time all year (UTC+4): a day in a filter or a report is a day on the clock in Baku.
BAKU = timezone(timedelta(hours=4), "Asia/Baku")

LOAD_AT_A_TIME = 500  # ids in one query
MAX_NOTES_PER_APPLICATION = 200  # staff's notes are short; a view of an application loads all of them

NOTES_COUNT = (
    select(func.count())
    .where(ApplicationNote.application_id == Application.id)
    .correlate(Application)
    .scalar_subquery()
)


def age_on(birth_date: date, day: date) -> int:
    return day.year - birth_date.year - ((day.month, day.day) < (birth_date.month, birth_date.day))


def start_of_day(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=BAKU)


def build_filter(filters: ApplicationFilter) -> list[ColumnElement[bool]]:
    """The filters the database applies. The search word is not one of them: see `matching_ids`."""
    clauses: list[ColumnElement[bool]] = []
    if filters.statuses:
        clauses.append(Application.status.in_([status.value for status in filters.statuses]))
    if filters.course_id is not None:
        clauses.append(Application.course_id == filters.course_id)
    if filters.language is not None:
        clauses.append(literal(filters.language) == any_(Application.languages))
    if filters.created_from is not None:
        clauses.append(Application.created_at >= start_of_day(filters.created_from))
    if filters.created_to is not None:
        clauses.append(Application.created_at < start_of_day(filters.created_to + timedelta(days=1)))
    return clauses


def describe_filter(filters: ApplicationFilter) -> dict[str, JsonValue]:
    """What was asked for, for the audit log: which filters, never the words that were searched for."""
    return {
        "searched": bool(filters.search),
        "statuses": [status.value for status in filters.statuses],
        "course_id": None if filters.course_id is None else str(filters.course_id),
        "language": filters.language,
        "created_from": None if filters.created_from is None else filters.created_from.isoformat(),
        "created_to": None if filters.created_to is None else filters.created_to.isoformat(),
    }


def to_summary(application: Application, notes_count: int) -> ApplicationSummary:
    course = application.course
    return ApplicationSummary(
        id=application.id,
        created_at=application.created_at,
        status=ApplicationStatus(application.status),
        parent_name=application.parent_name,
        phone=application.phone,
        languages=list(application.languages),
        children=[
            ChildRead(
                name=child.name,
                birth_date=child.birth_date,
                age_at_course_start=age_on(child.birth_date, course.start_date),
                within_age_range=course.age_min
                <= age_on(child.birth_date, course.start_date)
                <= course.age_max,
            )
            for child in application.children
        ],
        course=CourseReference(id=course.id, title=course.title, start_date=course.start_date),
        notes_count=notes_count,
    )


def ordering(newest_first: bool) -> tuple[UnaryExpression[datetime], InstrumentedAttribute[uuid.UUID]]:
    created = Application.created_at.desc() if newest_first else Application.created_at.asc()
    return created, Application.id  # the id keeps the order the same for applications of the same moment


def matching_ids(db: Session, filters: ApplicationFilter, newest_first: bool) -> list[uuid.UUID]:
    """Every application that passes the filters, in order. The search word is matched here.

    What a database's upper and lower case does with letters outside ASCII depends on how it was created, and
    staff must find "Əliyev" by typing "aliyev" or "ƏLİYEV" (text_search.py). So the names of the applications
    that pass the other filters are read and compared here: fine for the hundreds or thousands of applications
    of a programme.
    """
    query = select(Application.id).where(*build_filter(filters)).order_by(*ordering(newest_first))
    if not filters.search:
        return list(db.scalars(query).all())
    needle = Needle.of(filters.search)
    rows = db.execute(
        select(Application.id, Application.parent_name, Application.phone, func.array_agg(Child.name))
        .outerjoin(Child, Child.application_id == Application.id)
        .where(*build_filter(filters))
        .group_by(Application.id)
        .order_by(*ordering(newest_first))
    ).all()
    return [row[0] for row in rows if needle.found_in(row[1], row[2], row[3])]


def load_in_order(db: Session, ids: list[uuid.UUID]) -> list[tuple[Application, int]]:
    """The applications with their children, course and number of notes, in the order of `ids`."""
    loaded: dict[uuid.UUID, tuple[Application, int]] = {}
    for start in range(0, len(ids), LOAD_AT_A_TIME):
        rows = db.execute(
            select(Application, NOTES_COUNT)
            .options(selectinload(Application.children), joinedload(Application.course))
            .where(Application.id.in_(ids[start : start + LOAD_AT_A_TIME]))
        ).all()
        loaded.update({application.id: (application, notes_count) for application, notes_count in rows})
    return [loaded[application_id] for application_id in ids if application_id in loaded]


def search_applications(db: Session, principal: Principal, search: ApplicationSearch) -> ApplicationPage:
    newest_first = search.sort == "newest"
    if search.search:
        ids = matching_ids(db, search, newest_first)
        total, page_ids = len(ids), ids[search.offset : search.offset + search.limit]
    else:
        clauses = build_filter(search)
        total = db.scalar(select(func.count()).select_from(Application).where(*clauses)) or 0
        page_ids = list(
            db.scalars(
                select(Application.id)
                .where(*clauses)
                .order_by(*ordering(newest_first))
                .limit(search.limit)
                .offset(search.offset)
            ).all()
        )
    rows = load_in_order(db, page_ids)
    # The ids say whose names and numbers were shown, which is what has to be known if an account is misused.
    detail: dict[str, JsonValue] = {
        **describe_filter(search),
        "returned": len(rows),
        "offset": search.offset,
        "total": total,
        "ids": [str(application.id) for application, _ in rows],
    }
    audit.record(
        db, AuditEvent(principal.actor, AuditAction.APPLICATIONS_LISTED, "application", None, detail)
    )
    db.commit()
    return ApplicationPage(
        items=[to_summary(application, notes_count) for application, notes_count in rows],
        total=total,
        limit=search.limit,
        offset=search.offset,
    )


def load_application(
    db: Session, application_id: uuid.UUID, *, lock: bool = False
) -> tuple[Application, int]:
    """The application with its children, course and number of notes. `lock` keeps others from changing it."""
    query = (
        select(Application, NOTES_COUNT)
        .options(selectinload(Application.children), joinedload(Application.course))
        .where(Application.id == application_id)
    )
    if lock:
        query = query.with_for_update(of=Application)
    row = db.execute(query).one_or_none()
    if row is None:
        raise ApplicationNotFoundError
    return row[0], row[1]


def read_notes(db: Session, application_id: uuid.UUID) -> list[NoteRead]:
    rows = db.execute(
        select(ApplicationNote, AdminUser.display_name)
        .outerjoin(AdminUser, AdminUser.id == ApplicationNote.admin_id)
        .where(ApplicationNote.application_id == application_id)
        .order_by(ApplicationNote.created_at, ApplicationNote.id)
    ).all()
    return [
        NoteRead(id=note.id, body=note.body, created_at=note.created_at, author=author)
        for note, author in rows
    ]


def to_read(db: Session, application: Application, notes_count: int) -> ApplicationRead:
    summary = to_summary(application, notes_count)
    return ApplicationRead(
        **summary.model_dump(),
        status_changed_at=application.status_changed_at,
        consent_given_at=application.consent_given_at,
        privacy_notice_version=application.privacy_notice_version,
        notes=read_notes(db, application.id),
    )


def get_application(db: Session, principal: Principal, application_id: uuid.UUID) -> ApplicationRead:
    application, notes_count = load_application(db, application_id)
    result = to_read(db, application, notes_count)
    event = AuditEvent(principal.actor, AuditAction.APPLICATION_VIEWED, "application", application_id)
    audit.record(db, event)
    db.commit()
    return result


def seats_missing(db: Session, application: Application) -> tuple[int, int]:
    """How many places the application needs and how many the course has free (for a refusal)."""
    needed = db.scalar(select(func.count()).select_from(Child).where(Child.application_id == application.id))
    free = db.scalar(
        select(Course.capacity - func.course_seats_taken(Course.id)).where(Course.id == application.course_id)
    )
    return needed or 0, free or 0


def change_status(
    db: Session, principal: Principal, application_id: uuid.UUID, status: ApplicationStatus, now: datetime
) -> ApplicationRead:
    """Move an application to another status. Approving needs free places in its course.

    Taking an approval back is for whoever may also erase (SEC-B-04, SEC-B-09): an application that is not
    approved is deleted by the retention job once it is old enough, so leaving `approved` is an erasure in
    effect.
    """
    # Locked, so that two people changing it at once cannot both record the same "from" in the audit log.
    application, notes_count = load_application(db, application_id, lock=True)
    previous = application.status
    if previous != status.value:
        if previous == ApplicationStatus.APPROVED.value and not has_permission(
            principal.role, Permission.APPLICATIONS_DELETE
        ):
            db.rollback()  # release the lock
            raise ApprovalLockedError
        application.status = status.value
        application.status_changed_at = now
        detail: dict[str, JsonValue] = {"from": previous, "to": status.value}
        audit.record(
            db,
            AuditEvent(
                principal.actor, AuditAction.APPLICATION_STATUS_CHANGED, "application", application_id, detail
            ),
        )
        try:
            db.commit()
        except DBAPIError as error:
            db.rollback()
            if sqlstate_of(error) != NOT_ENOUGH_SEATS:
                raise
            needed, free = seats_missing(db, application)
            raise NotEnoughSeatsError(needed=needed, free_seats=free) from None
    return to_read(db, application, notes_count)


def add_note(db: Session, principal: Principal, application_id: uuid.UUID, body: str) -> NoteRead:
    if db.scalar(select(exists().where(Application.id == application_id))) is not True:
        raise ApplicationNotFoundError
    noted = db.scalar(
        select(func.count())
        .select_from(ApplicationNote)
        .where(ApplicationNote.application_id == application_id)
    )
    if (noted or 0) >= MAX_NOTES_PER_APPLICATION:
        raise TooManyNotesError(maximum=MAX_NOTES_PER_APPLICATION)
    note = ApplicationNote(application_id=application_id, admin_id=principal.admin_id, body=body)
    db.add(note)
    db.flush()
    audit.record(
        db, AuditEvent(principal.actor, AuditAction.APPLICATION_NOTE_ADDED, "application", application_id)
    )
    db.commit()
    return NoteRead(id=note.id, body=note.body, created_at=note.created_at, author=principal.display_name)


def delete_note(db: Session, principal: Principal, application_id: uuid.UUID, note_id: uuid.UUID) -> None:
    # Both ids must match: a note cannot be taken back through another application's address.
    deleted = db.execute(
        delete(ApplicationNote)
        .where(ApplicationNote.id == note_id, ApplicationNote.application_id == application_id)
        .returning(ApplicationNote.id)
    ).first()
    if deleted is None:
        raise NoteNotFoundError
    event = AuditEvent(principal.actor, AuditAction.APPLICATION_NOTE_DELETED, "application", application_id)
    audit.record(db, event)
    db.commit()


def erase_application(db: Session, principal: Principal, application_id: uuid.UUID) -> None:
    """Really delete an application with its children and notes, at a parent's request (SEC-B-09)."""
    erased = db.execute(
        delete(Application)
        .where(Application.id == application_id)
        .returning(Application.status, Application.course_id)
    ).first()
    if erased is None:
        raise ApplicationNotFoundError
    detail: dict[str, JsonValue] = {"status": erased.status, "course_id": str(erased.course_id)}
    audit.record(
        db,
        AuditEvent(principal.actor, AuditAction.APPLICATION_DELETED, "application", application_id, detail),
    )
    db.commit()


def pulse(db: Session) -> Pulse:
    total, new, latest = db.execute(
        select(
            func.count(),
            func.count().filter(Application.status == ApplicationStatus.NEW.value),
            func.max(Application.created_at),
        )
    ).one()
    return Pulse(applications_total=total, new_applications=new, latest_application_at=latest)
