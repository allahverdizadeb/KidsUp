"""Rows for the tests: obviously fake, and the database is real."""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime

from app.db import SessionLocal
from app.models import Application, Child, Course

# The course every test starts with (conftest.clean_database): open, 20 places, like the landing page.
DEFAULT_COURSE_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
NOTICE_VERSION = "2026-10-19"


def make_course(**overrides: object) -> Course:
    values: dict[str, object] = {
        "title": "Test course",
        "start_date": date(2026, 12, 5),
        "schedule": "Saturday, 09:30-13:00",
        "location": "Baku",
        "age_min": 8,
        "age_max": 13,
        "price_minor": 65_000,
        "second_child_price_minor": 50_000,
        "capacity": 20,
        "registration_open": True,
        **overrides,
    }
    return Course(**values)


def add_course(**overrides: object) -> uuid.UUID:
    with SessionLocal() as db:
        course = make_course(**overrides)
        db.add(course)
        db.commit()
        return course.id


def add_family(
    parent: str = "Aysel Test",
    phone: str = "+994 50 123 45 67",
    children: Sequence[tuple[str, date]] = (("Leyla Test", date(2016, 3, 14)),),
    languages: Sequence[str] = ("Azərbaycan",),
    **options: object,
) -> uuid.UUID:
    """An application with its children. `options`: status, created_at, course_id (columns of Application)."""
    created_at = options.pop("created_at", None) or datetime.now(UTC)
    values: dict[str, object] = {"course_id": DEFAULT_COURSE_ID, **options}
    with SessionLocal() as db:
        application = Application(
            parent_name=parent,
            phone=phone,
            languages=list(languages),
            created_at=created_at,
            consent_given_at=created_at,
            privacy_notice_version=NOTICE_VERSION,
            children=[
                Child(position=position, name=name, birth_date=birth_date)
                for position, (name, birth_date) in enumerate(children)
            ],
            **values,
        )
        db.add(application)
        db.commit()
        return application.id
