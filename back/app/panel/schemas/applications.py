import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.models import ApplicationStatus
from app.panel.schemas.common import NO_CONTROL_CHARACTERS_BUT_LINE_BREAKS, UtcDateTime
from app.schemas.application import Language

SearchText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
# A day in a filter: far from the ends of what a date can hold, so adding a day to it cannot overflow.
FilterDate = Annotated[date, Field(ge=date(2020, 1, 1), le=date(2100, 12, 31))]


class ApplicationFilter(BaseModel):
    """Which applications. Sent in the body, never in the address: a search term can be a name or a number."""

    search: SearchText | None = None  # part of a parent's or child's name, or of a phone number
    statuses: Annotated[list[ApplicationStatus], Field(max_length=len(ApplicationStatus))] = []
    course_id: uuid.UUID | None = None
    language: Language | None = None
    created_from: FilterDate | None = None
    created_to: FilterDate | None = None


class ApplicationSearch(ApplicationFilter):
    sort: Literal["newest", "oldest"] = "newest"
    limit: int = Field(default=25, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=1_000_000)


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus


class NoteCreate(BaseModel):
    body: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=2000,
            pattern=NO_CONTROL_CHARACTERS_BUT_LINE_BREAKS,
        ),
    ]


class ChildRead(BaseModel):
    name: str
    birth_date: date
    age_at_course_start: int
    within_age_range: bool


class CourseReference(BaseModel):
    id: uuid.UUID
    title: str
    start_date: date


class NoteRead(BaseModel):
    id: uuid.UUID
    body: str
    created_at: UtcDateTime
    author: str | None  # the staff member's name, empty if the account has been removed


class ApplicationSummary(BaseModel):
    id: uuid.UUID
    created_at: UtcDateTime
    status: ApplicationStatus
    parent_name: str
    phone: str
    languages: list[str]
    children: list[ChildRead]
    course: CourseReference
    notes_count: int


class ApplicationRead(ApplicationSummary):
    status_changed_at: UtcDateTime | None
    # What the parent agreed to and when: empty only for applications from before the notice existed.
    consent_given_at: UtcDateTime | None
    privacy_notice_version: str | None
    notes: list[NoteRead]


class ApplicationPage(BaseModel):
    items: list[ApplicationSummary]
    total: int
    limit: int
    offset: int


class Pulse(BaseModel):
    """What a page polls for: has anything arrived. No personal data in it."""

    applications_total: int
    new_applications: int
    latest_application_at: UtcDateTime | None
