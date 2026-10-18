import runpy
import sys
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app import cli
from app.db import SessionLocal
from app.models import Application, Child
from app.services import retention
from tests.conftest import make_settings

NOW = datetime(2026, 12, 1, tzinfo=UTC)
RETENTION_DAYS = 365


def add_application(
    age_days: int, status: str = "new", phone: str = "+994 50 123 45 67", now: datetime = NOW
) -> uuid.UUID:
    with SessionLocal() as db:
        application = Application(
            parent_name="Aysel",
            phone=phone,
            languages=["Rus"],
            status=status,
            created_at=now - timedelta(days=age_days),
            children=[Child(position=0, name="Leyla", birth_date=date(2016, 3, 14))],
        )
        db.add(application)
        db.commit()
        return application.id


def stored_application_ids() -> set[uuid.UUID]:
    with SessionLocal() as db:
        return set(db.scalars(select(Application.id)).all())


def stored_children_count() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(Child)) or 0


def test_only_old_applications_that_never_led_to_enrolment_are_deleted():
    expired = add_application(age_days=400)
    recent = add_application(age_days=100)
    enrolled = add_application(age_days=400, status="enrolled")

    with SessionLocal() as db:
        deleted = retention.delete_expired_applications(db, NOW, RETENTION_DAYS)

    assert deleted == 1
    assert stored_application_ids() == {recent, enrolled}
    assert expired not in stored_application_ids()
    assert stored_children_count() == 2  # the expired application's child went with it


def test_the_retention_period_is_inclusive():
    exactly_one_year = add_application(age_days=RETENTION_DAYS)
    one_day_over = add_application(age_days=RETENTION_DAYS + 1)

    with SessionLocal() as db:
        retention.delete_expired_applications(db, NOW, RETENTION_DAYS)

    assert stored_application_ids() == {exactly_one_year}
    assert one_day_over not in stored_application_ids()


def test_erasing_an_application_deletes_it_and_its_children_for_real():
    erased = add_application(age_days=1)
    kept = add_application(age_days=1)

    with SessionLocal() as db:
        assert retention.erase_application(db, erased) is True
        assert retention.erase_application(db, uuid.uuid4()) is False

    assert stored_application_ids() == {kept}
    assert stored_children_count() == 1


@pytest.mark.parametrize("typed", ["+994 50 123 45 67", "994501234567", "(994) 50-123-45-67"])
def test_erasing_by_phone_matches_the_digits_whatever_the_formatting(typed):
    add_application(age_days=1, phone="+994 50 123 45 67")
    add_application(age_days=2, phone="994-50-123-45-67")
    other = add_application(age_days=1, phone="+994 55 765 43 21")

    with SessionLocal() as db:
        assert retention.erase_applications_by_phone(db, typed) == 2

    assert stored_application_ids() == {other}


def test_a_phone_without_digits_never_matches_anything():
    kept = add_application(age_days=1)
    with SessionLocal() as db:
        assert retention.erase_applications_by_phone(db, "no digits here") == 0
    assert stored_application_ids() == {kept}


def test_retention_period_must_be_sensible():
    with pytest.raises(ValueError, match="retention_days"):
        make_settings(retention_days=1)
    assert make_settings(retention_days=90).retention_days == 90


def test_cli_purges_expired_applications():
    today = datetime.now(UTC)  # the command uses the real clock
    expired = add_application(age_days=RETENTION_DAYS + 30, now=today)
    recent = add_application(age_days=1, now=today)

    assert cli.main(["purge-expired"]) == 0

    assert stored_application_ids() == {recent}
    assert expired not in stored_application_ids()


def test_cli_erases_one_application_by_id():
    erased = add_application(age_days=1)

    assert cli.main(["erase-application", str(erased)]) == 0
    assert cli.main(["erase-application", str(erased)]) == 1  # already gone

    assert stored_application_ids() == set()


def test_cli_erases_by_phone_asked_on_the_terminal_not_in_the_arguments(monkeypatch):
    add_application(age_days=1, phone="+994 50 123 45 67")
    monkeypatch.setattr("builtins.input", lambda _prompt: "050 123 45 67")  # different digits: no match
    assert cli.main(["erase-by-phone"]) == 1
    assert len(stored_application_ids()) == 1

    monkeypatch.setattr("builtins.input", lambda _prompt: "+994 50 123 45 67")
    assert cli.main(["erase-by-phone"]) == 0
    assert stored_application_ids() == set()


def test_running_the_cli_module_as_a_script_exits_with_the_command_status(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["python -m app.cli", "erase-application", str(uuid.uuid4())])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("app.cli", run_name="__main__")
    assert exit_info.value.code == 1  # no such application
