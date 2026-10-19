import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Application, ApplicationStatus, Child
from app.services import retention

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


def test_the_children_of_a_deleted_application_go_with_it():
    add_application(age_days=400)
    add_application(age_days=100)

    with SessionLocal() as db:
        retention.delete_expired_applications(db, NOW, RETENTION_DAYS)

    assert stored_children_count() == 1


def test_an_application_exactly_at_the_retention_age_is_kept_and_one_day_older_is_deleted():
    at_the_limit = add_application(age_days=RETENTION_DAYS)
    one_day_over = add_application(age_days=RETENTION_DAYS + 1)

    with SessionLocal() as db:
        retention.delete_expired_applications(db, NOW, RETENTION_DAYS)

    assert stored_application_ids() == {at_the_limit}
    assert one_day_over not in stored_application_ids()


def test_counting_the_expired_applications_deletes_nothing():
    add_application(age_days=400)
    add_application(age_days=100)
    add_application(age_days=400, status="enrolled")

    with SessionLocal() as db:
        assert retention.count_expired_applications(db, NOW, RETENTION_DAYS) == 1

    assert len(stored_application_ids()) == 3


def test_a_family_marked_as_enrolled_is_never_purged():
    marked = add_application(age_days=900)
    with SessionLocal() as db:
        assert retention.mark_enrolled(db, marked) is True
        assert retention.delete_expired_applications(db, NOW, RETENTION_DAYS) == 0

    assert stored_application_ids() == {marked}


def test_marking_an_unknown_application_changes_nothing():
    kept = add_application(age_days=1)
    with SessionLocal() as db:
        assert retention.mark_enrolled(db, uuid.uuid4()) is False

    with SessionLocal() as db:
        assert db.scalar(select(Application.status).where(Application.id == kept)) == ApplicationStatus.NEW


def test_erasing_an_application_deletes_it_and_its_children_for_real():
    erased = add_application(age_days=1)
    kept = add_application(age_days=1)

    with SessionLocal() as db:
        assert retention.erase_application(db, erased) is True
        assert retention.erase_application(db, uuid.uuid4()) is False

    assert stored_application_ids() == {kept}
    assert stored_children_count() == 1


@pytest.mark.parametrize(
    "typed",
    [
        "+994 50 123 45 67",
        "994501234567",
        "(994) 50-123-45-67",
        "050 123 45 67",  # how a parent writes it locally: the trunk 0 instead of +994
        "0501234567",
        "501234567",
    ],
)
def test_a_phone_number_is_found_whatever_its_formatting_or_country_prefix(typed):
    first = add_application(age_days=1, phone="+994 50 123 45 67")
    second = add_application(age_days=2, phone="050-123-45-67")
    add_application(age_days=1, phone="+994 55 765 43 21")

    with SessionLocal() as db:
        found = retention.find_applications_by_phone(db, typed)

    assert {application_id for application_id, _ in found} == {first, second}


def test_finding_by_phone_lists_the_oldest_first_and_only_ids_and_dates():
    older = add_application(age_days=30)
    newer = add_application(age_days=2)

    with SessionLocal() as db:
        found = retention.find_applications_by_phone(db, "+994 50 123 45 67")

    assert [application_id for application_id, _ in found] == [older, newer]
    assert all(isinstance(created_at, datetime) for _, created_at in found)


@pytest.mark.parametrize("typed", ["", "no digits here", "12345678", "+994 50 123"])
def test_a_phone_number_with_too_few_digits_is_refused_and_nothing_is_matched(typed):
    # A stored phone without any digit ("n/a") must not be matched by an empty number.
    kept = add_application(age_days=1, phone="n/a")

    with SessionLocal() as db, pytest.raises(ValueError, match="at least 9 digits"):
        retention.find_applications_by_phone(db, typed)

    assert stored_application_ids() == {kept}


def test_erasing_applications_deletes_exactly_the_ones_given():
    erased = add_application(age_days=1)
    kept = add_application(age_days=1)

    with SessionLocal() as db:
        assert retention.erase_applications(db, [erased]) == 1

    assert stored_application_ids() == {kept}
    assert stored_children_count() == 1
