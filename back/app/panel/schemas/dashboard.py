from datetime import date

from pydantic import BaseModel

from app.panel.schemas.applications import ApplicationSummary
from app.panel.schemas.common import UtcDateTime
from app.panel.schemas.courses import CourseRead, StatusCounts


class DashboardTotals(BaseModel):
    applications: int
    by_status: StatusCounts
    approved_children: int  # the participants: children of approved applications
    free_seats: int  # in the courses that are open for registration


class DailyCount(BaseModel):
    day: date  # a day on the clock in Baku
    applications: int


class DashboardRead(BaseModel):
    """Everything on the first page of the panel, computed from the stored applications and courses."""

    generated_at: UtcDateTime
    totals: DashboardTotals
    courses: list[CourseRead]
    latest_applications: list[ApplicationSummary]
    dynamics: list[DailyCount]  # applications received on each of the last days, today last
