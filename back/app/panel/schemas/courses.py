import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
    model_validator,
)

from app.panel.schemas.common import NO_CONTROL_CHARACTERS, UtcDateTime, VisibleOnly

# These texts are published as they are typed (the course list, the order form, the texts that use
# {schedule} and {location}), so a line break, a control character or a text-direction override is refused.
Title = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120, pattern=NO_CONTROL_CHARACTERS),
    VisibleOnly,
]
Schedule = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=120, pattern=NO_CONTROL_CHARACTERS),
    VisibleOnly,
]
Location = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200, pattern=NO_CONTROL_CHARACTERS),
    VisibleOnly,
]
# Strict: only a JSON number or boolean counts, not the text "5" or "yes" (SEC-B-01).
Age = Annotated[StrictInt, Field(ge=0, le=25)]
Money = Annotated[StrictInt, Field(ge=0, le=10_000_000)]  # whole qəpik: 1 AZN = 100 qəpik
Places = Annotated[StrictInt, Field(ge=1, le=500)]
StartDate = Annotated[date, Field(ge=date(2020, 1, 1), le=date(2100, 12, 31))]


class CourseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # a field the API does not know is an error, not ignored

    title: Title
    start_date: StartDate
    end_date: StartDate | None = None  # optional; when there is one it is not before the start
    schedule: Schedule
    location: Location
    age_min: Age
    age_max: Age
    price_minor: Money
    second_child_price_minor: Money
    currency: Literal["AZN"] = "AZN"
    capacity: Places
    registration_open: StrictBool = False  # a new course is opened on purpose

    @model_validator(mode="after")
    def ages_and_dates_are_in_order(self) -> "CourseCreate":
        if self.age_min > self.age_max:
            raise ValueError("The youngest age is above the oldest.")
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("The course ends before it starts.")
        return self


class CourseUpdate(BaseModel):
    """Only what is sent changes. The ages are checked against the stored course by the service."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    start_date: StartDate | None = None
    end_date: StartDate | None = None
    schedule: Schedule | None = None
    location: Location | None = None
    age_min: Age | None = None
    age_max: Age | None = None
    price_minor: Money | None = None
    second_child_price_minor: Money | None = None
    capacity: Places | None = None
    registration_open: StrictBool | None = None


class StatusCounts(BaseModel):
    new: int = 0
    contacted: int = 0
    approved: int = 0
    declined: int = 0


class SeatsRead(BaseModel):
    capacity: int
    approved_children: int  # a seat is taken by an approved child
    free_seats: int
    # Applications of the course by status (an application brings one or two children).
    applications: StatusCounts


class CourseRead(BaseModel):
    id: uuid.UUID
    title: str
    start_date: date
    end_date: date | None
    schedule: str
    location: str
    age_min: int
    age_max: int
    price_minor: int
    second_child_price_minor: int
    currency: str
    capacity: int
    registration_open: bool
    # Whether the landing page takes applications for it now: open, and with a free seat.
    accepting_applications: bool
    seats: SeatsRead
    created_at: UtcDateTime
    updated_at: UtcDateTime


class CoursePage(BaseModel):
    items: list[CourseRead]
    total: int
    limit: int
    offset: int
