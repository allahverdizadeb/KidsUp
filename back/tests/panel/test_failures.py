"""What happens when something other than the course rules goes wrong (SEC-B-12): nothing is mistaken for one.

A database error that is not one of the course rules (a lost connection, a timeout) must reach the error
handler as itself, not be dressed up as "the course is full"; and public files that cannot be written must be
logged and survived, not crash the refresh.
"""

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.models import Application, ApplicationStatus, Course
from app.panel import content_registry
from app.panel.principal import Principal
from app.panel.schemas.courses import CourseUpdate
from app.panel.services import applications, content, courses
from app.panel.services.snapshots import PublicFiles
from tests.factories import add_course, add_family
from tests.panel.support import Staff

NOW = datetime(2026, 11, 2, 10, 0, tzinfo=UTC)


def lost_connection(statement: str) -> OperationalError:
    return OperationalError(statement, {}, Exception("the connection to the database was lost"))


class SessionWhoseCommitFails(Session):
    def commit(self) -> None:
        raise lost_connection("COMMIT")


class SessionWhoseStatementsFail(Session):
    def execute(self, *_arguments: Any, **_options: Any) -> Any:
        raise lost_connection("DELETE")


def principal_of(staff: Staff) -> Principal:
    return Principal(
        admin_id=staff.id,
        email=staff.email,
        display_name="Test Staff",
        role=staff.role,
        session_id=uuid.uuid4(),
        csrf_token="not used here",
        network=None,
    )


def test_a_lost_connection_while_changing_a_status_is_not_reported_as_a_full_course(staff):
    application_id = add_family()

    with SessionWhoseCommitFails(bind=engine) as db, pytest.raises(OperationalError):
        applications.change_status(db, principal_of(staff), application_id, ApplicationStatus.CONTACTED, NOW)

    with SessionLocal() as db:
        assert db.scalars(select(Application.status).where(Application.id == application_id)).one() == "new"


def test_a_lost_connection_while_changing_a_course_is_not_reported_as_a_capacity_problem(staff):
    course_id = add_course(capacity=20)

    with SessionWhoseCommitFails(bind=engine) as db, pytest.raises(OperationalError):
        courses.update_course(db, principal_of(staff), course_id, CourseUpdate(capacity=30))

    with SessionLocal() as db:
        assert db.get(Course, course_id).capacity == 20  # type: ignore[union-attr]


def test_a_lost_connection_while_deleting_a_course_is_not_reported_as_a_course_with_applications(staff):
    course_id = add_course()

    with SessionWhoseStatementsFail(bind=engine) as db, pytest.raises(OperationalError):
        courses.delete_course(db, principal_of(staff), course_id)

    with SessionLocal() as db:
        assert db.get(Course, course_id) is not None


def test_published_texts_that_cannot_be_written_are_logged_and_the_refresh_goes_on(tmp_path, caplog):
    (tmp_path / "content").write_text("a file where the directory should be", encoding="utf-8")
    files = PublicFiles(tmp_path / "content")

    with SessionLocal() as db, caplog.at_level(logging.ERROR):
        refreshed = content.refresh_site(db, files)

    assert refreshed is False
    assert "could not be written" in caplog.text


def test_published_texts_that_can_be_written_are_written(tmp_path):
    files = PublicFiles(Path(tmp_path) / "content")

    with SessionLocal() as db:
        assert content.refresh_site(db, files) is True

    assert (tmp_path / "content" / "site.json").exists()


def test_a_registry_whose_parts_are_not_a_list_is_refused_when_it_is_read():
    broken: dict[str, JsonValue] = {
        "key": "x.y",
        "section": "hero",
        "label": "X",
        "kind": "list",
        "default": [],
        "item": "text",
    }

    with pytest.raises(TypeError, match="must be a list"):
        content_registry.read_field(broken)
