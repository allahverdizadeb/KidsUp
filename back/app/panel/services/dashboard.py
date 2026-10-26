"""The numbers on the first page of the panel. All of them are read from the stored data, none is typed in."""

from collections import Counter
from datetime import datetime, timedelta

from pydantic import JsonValue
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Application
from app.panel.principal import Principal
from app.panel.schemas.courses import StatusCounts
from app.panel.schemas.dashboard import DailyCount, DashboardRead, DashboardTotals
from app.panel.services import audit
from app.panel.services.applications import BAKU, load_in_order, start_of_day, to_summary
from app.panel.services.audit import AuditAction, AuditEvent
from app.panel.services.courses import load_courses

LATEST_APPLICATIONS = 7


def count_by_status(db: Session) -> StatusCounts:
    counts = StatusCounts()
    for status, count in db.execute(select(Application.status, func.count()).group_by(Application.status)):
        setattr(counts, status, count)
    return counts


def daily_counts(db: Session, now: datetime, days: int) -> list[DailyCount]:
    """Applications received on each of the last `days` days, today last; a day without any counts as 0."""
    today = now.astimezone(BAKU).date()
    first = today - timedelta(days=days - 1)
    received = db.scalars(select(Application.created_at).where(Application.created_at >= start_of_day(first)))
    per_day = Counter(moment.astimezone(BAKU).date() for moment in received)
    return [
        DailyCount(day=first + timedelta(days=n), applications=per_day[first + timedelta(days=n)])
        for n in range(days)
    ]


def build_dashboard(db: Session, principal: Principal, now: datetime, days: int) -> DashboardRead:
    courses = load_courses(db)
    by_status = count_by_status(db)
    latest_ids = db.scalars(
        select(Application.id)
        .order_by(Application.created_at.desc(), Application.id)
        .limit(LATEST_APPLICATIONS)
    ).all()
    latest = [to_summary(application, notes) for application, notes in load_in_order(db, list(latest_ids))]
    detail: dict[str, JsonValue] = {
        "source": "dashboard",
        "returned": len(latest),
        "ids": [str(summary.id) for summary in latest],
    }
    audit.record(
        db, AuditEvent(principal.actor, AuditAction.APPLICATIONS_LISTED, "application", None, detail)
    )
    db.commit()
    return DashboardRead(
        generated_at=now,
        totals=DashboardTotals(
            applications=by_status.new + by_status.contacted + by_status.approved + by_status.declined,
            by_status=by_status,
            approved_children=sum(course.seats.approved_children for course in courses),
            free_seats=sum(course.seats.free_seats for course in courses if course.registration_open),
        ),
        courses=courses,
        latest_applications=latest,
        dynamics=daily_counts(db, now, days),
    )
