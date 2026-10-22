"""The rules about courses, which hold whoever writes the rows (alembic/versions/0006).

* an application is stored only for a course that is open and has free seats, and one sent without a
  course goes to the one open course;
* a seat is taken by an approved child, and an application is approved only while enough seats are free;
* a course never has fewer places than approved children.
"""

import threading
import time
import uuid
from datetime import date

import pytest
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.database_errors import CAPACITY_BELOW_APPROVED, NOT_ENOUGH_SEATS, REGISTRATION_CLOSED, sqlstate_of
from app.db import SessionLocal
from app.models import Application, Child, Course
from tests.factories import DEFAULT_COURSE_ID, make_course
from tests.test_applications import VALID, stored_applications, with_


def add_course(**overrides: object) -> uuid.UUID:
    with SessionLocal() as db:
        course = make_course(**overrides)
        db.add(course)
        db.commit()
        return course.id


def add_application(
    course_id: uuid.UUID = DEFAULT_COURSE_ID, status: str = "new", children: int = 1
) -> uuid.UUID:
    with SessionLocal() as db:
        application = Application(
            parent_name="Aysel",
            phone="+994 50 123 45 67",
            languages=["Rus"],
            course_id=course_id,
            status=status,
            children=[Child(position=i, name="Leyla", birth_date=date(2016, 3, 14)) for i in range(children)],
        )
        db.add(application)
        db.commit()
        return application.id


def set_status(application_id: uuid.UUID, status: str) -> None:
    with SessionLocal() as db:
        db.execute(update(Application).where(Application.id == application_id).values(status=status))
        db.commit()


def status_of(application_id: uuid.UUID) -> str:
    with SessionLocal() as db:
        return db.scalars(select(Application.status).where(Application.id == application_id)).one()


def refused_with(statement: str, **parameters: object) -> str | None:
    """The SQLSTATE with which the database refuses a statement, or None if it accepts it."""
    with SessionLocal() as db:
        try:
            db.execute(text(statement), parameters)
            db.commit()
        except DBAPIError as error:
            return sqlstate_of(error)
    return None


# --- who may apply (KU001)


def test_an_application_without_a_course_goes_to_the_one_open_course(client):
    assert client.post("/api/applications", json=VALID).status_code == 201

    assert stored_applications()[0].course_id == DEFAULT_COURSE_ID


def test_an_application_names_its_course(client):
    other = add_course(title="Another group", registration_open=True)

    assert client.post("/api/applications", json=with_(course_id=str(other))).status_code == 201

    assert stored_applications()[0].course_id == other


def test_an_application_for_a_closed_course_is_refused_and_nothing_is_stored(client):
    closed = add_course(registration_open=False)

    response = client.post("/api/applications", json=with_(course_id=str(closed)))

    assert response.status_code == 409
    assert response.json() == {"detail": "Registration is closed."}
    assert stored_applications() == []


def test_an_application_is_refused_when_registration_is_closed_everywhere(client):
    with SessionLocal() as db:
        db.execute(update(Course).values(registration_open=False))
        db.commit()

    assert client.post("/api/applications", json=VALID).status_code == 409
    assert stored_applications() == []


def test_an_application_without_a_course_is_refused_when_several_are_open(client):
    add_course(title="Another group", registration_open=True)

    assert client.post("/api/applications", json=VALID).status_code == 409
    assert stored_applications() == []


def test_an_application_for_a_course_that_does_not_exist_is_refused_like_a_closed_one(client):
    # Not a foreign key error and not a 500: the visitor learns nothing about which courses exist.
    response = client.post("/api/applications", json=with_(course_id=str(uuid.uuid4())))

    assert response.status_code == 409
    assert stored_applications() == []


def test_a_course_id_that_is_not_a_uuid_is_a_validation_error(client):
    assert client.post("/api/applications", json=with_(course_id="not-a-uuid")).status_code == 422


def test_the_api_does_not_say_why_registration_is_closed(client):
    closed = add_course(registration_open=False)
    full = add_course(capacity=1, registration_open=True)
    add_application(full, status="approved")

    bodies = {
        client.post("/api/applications", json=with_(course_id=str(course))).text for course in (closed, full)
    }

    assert len(bodies) == 1


def test_a_full_course_takes_no_more_applications(client):
    full = add_course(capacity=2)
    add_application(full, status="approved", children=2)

    assert client.post("/api/applications", json=with_(course_id=str(full))).status_code == 409


def test_a_course_with_a_free_seat_still_takes_applications(client):
    almost_full = add_course(capacity=3)
    add_application(almost_full, status="approved", children=2)

    assert client.post("/api/applications", json=with_(course_id=str(almost_full))).status_code == 201


def test_applications_waiting_for_an_answer_do_not_take_seats(client):
    course = add_course(capacity=1)
    add_application(course, status="new")
    add_application(course, status="contacted")
    add_application(course, status="declined")

    assert client.post("/api/applications", json=with_(course_id=str(course))).status_code == 201


def test_the_database_refuses_an_application_for_a_closed_course_whoever_sends_it():
    closed = add_course(registration_open=False)

    with pytest.raises(DBAPIError) as error:
        add_application(closed)

    assert sqlstate_of(error.value) == REGISTRATION_CLOSED


# --- approving takes seats (KU002)


def test_approving_an_application_takes_one_seat_for_each_child():
    course = add_course(capacity=3)
    family = add_application(course, children=2)
    single = add_application(course, children=1)
    another = add_application(course, children=1)

    set_status(family, "approved")
    set_status(single, "approved")  # 3 of 3 seats now

    assert refused_with("UPDATE applications SET status = 'approved' WHERE id = :id", id=another) == (
        NOT_ENOUGH_SEATS
    )
    assert status_of(another) == "new"


def test_an_application_with_two_children_is_not_approved_when_only_one_seat_is_free():
    course = add_course(capacity=2)
    add_application(course, status="approved", children=1)
    family = add_application(course, children=2)

    assert refused_with("UPDATE applications SET status = 'approved' WHERE id = :id", id=family) == (
        NOT_ENOUGH_SEATS
    )
    assert status_of(family) == "new"


def test_the_last_seat_can_be_taken():
    course = add_course(capacity=2)
    add_application(course, status="approved", children=1)
    last = add_application(course, children=1)

    set_status(last, "approved")

    assert status_of(last) == "approved"


def test_approving_an_application_again_is_not_counted_twice():
    course = add_course(capacity=1)
    only = add_application(course, children=1)
    set_status(only, "approved")

    set_status(only, "approved")

    assert status_of(only) == "approved"


@pytest.mark.parametrize("leaving", ["new", "contacted", "declined"])
def test_declining_or_reopening_an_approved_application_frees_its_seats(leaving):
    course = add_course(capacity=1)
    first = add_application(course, children=1)
    second = add_application(course, children=1)
    set_status(first, "approved")
    assert refused_with("UPDATE applications SET status = 'approved' WHERE id = :id", id=second) is not None

    set_status(first, leaving)
    set_status(second, "approved")

    assert status_of(second) == "approved"


def test_deleting_an_approved_application_frees_its_seats():
    course = add_course(capacity=1)
    first = add_application(course, children=1)
    second = add_application(course, children=1)
    set_status(first, "approved")

    with SessionLocal() as db:
        db.execute(text("DELETE FROM applications WHERE id = :id"), {"id": first})
        db.commit()
    set_status(second, "approved")

    assert status_of(second) == "approved"


def test_seats_are_counted_for_each_course_on_its_own():
    small, large = add_course(capacity=1), add_course(capacity=5)
    set_status(add_application(small), "approved")
    in_the_large_one = add_application(large)

    set_status(in_the_large_one, "approved")  # the full course next door does not matter

    assert status_of(in_the_large_one) == "approved"


def wait_until_a_session_waits_for_a_lock(timeout_seconds: float = 5.0) -> None:
    """Polls the database instead of sleeping for a guessed time.

    Every poll opens a new session: `pg_stat_activity` is cached for the length of a transaction, so a session
    that keeps polling inside one transaction keeps seeing the picture of its first look, and would miss a
    wait that begins a moment later (the test failed that way whenever the other thread was a little slow).
    """
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        with SessionLocal() as db:
            waiting = db.scalar(
                text(
                    "SELECT count(*) FROM pg_stat_activity "
                    "WHERE wait_event_type = 'Lock' AND datname = current_database()"
                )
            )
        if waiting:
            return
        time.sleep(0.01)
    pytest.fail("the second approval did not wait for the first: the course row is not locked")


def test_two_people_approving_at_once_cannot_share_the_last_seat():
    course = add_course(capacity=1)
    first, second = add_application(course), add_application(course)
    outcome: dict[str, str | None] = {}

    def approve_the_second() -> None:
        with SessionLocal() as db:
            try:
                db.execute(update(Application).where(Application.id == second).values(status="approved"))
                db.commit()
                outcome["error"] = None
            except DBAPIError as error:
                outcome["error"] = sqlstate_of(error)

    with SessionLocal() as db:
        db.execute(update(Application).where(Application.id == first).values(status="approved"))
        # `first` is not committed yet: it holds the course. The second approval must wait for it.
        other = threading.Thread(target=approve_the_second)
        other.start()
        wait_until_a_session_waits_for_a_lock()
        db.commit()
        other.join(timeout=10)

    assert not other.is_alive()
    assert outcome == {"error": NOT_ENOUGH_SEATS}
    assert status_of(first) == "approved"
    assert status_of(second) == "new"


# --- the capacity of a course (KU003) and its other limits


def test_a_course_cannot_get_fewer_places_than_the_children_already_approved():
    course = add_course(capacity=5)
    add_application(course, status="approved", children=2)

    assert (
        refused_with("UPDATE courses SET capacity = 1 WHERE id = :id", id=course) == CAPACITY_BELOW_APPROVED
    )
    assert refused_with("UPDATE courses SET capacity = 2 WHERE id = :id", id=course) is None  # exactly enough
    assert refused_with("UPDATE courses SET capacity = 9 WHERE id = :id", id=course) is None  # more is fine


def test_other_changes_to_a_full_course_are_not_blocked_by_the_capacity_rule():
    course = add_course(capacity=1)
    add_application(course, status="approved")

    assert refused_with("UPDATE courses SET title = 'Renamed' WHERE id = :id", id=course) is None


def test_a_course_with_applications_cannot_be_deleted():
    course = add_course()
    add_application(course)

    with SessionLocal() as db, pytest.raises(IntegrityError, match="fk_applications_course_id"):
        db.execute(text("DELETE FROM courses WHERE id = :id"), {"id": course})


def test_a_course_without_applications_can_be_deleted():
    course = add_course()

    assert refused_with("DELETE FROM courses WHERE id = :id", id=course) is None


@pytest.mark.parametrize(
    ("changes", "constraint"),
    [
        ({"title": "   "}, "ck_courses_title_not_blank"),
        ({"capacity": 0}, "ck_courses_capacity_range"),
        ({"capacity": 501}, "ck_courses_capacity_range"),
        ({"price_minor": -1}, "ck_courses_prices_range"),
        ({"second_child_price_minor": 10_000_001}, "ck_courses_prices_range"),
        ({"age_min": 9, "age_max": 8}, "ck_courses_age_range"),
        ({"age_max": 26}, "ck_courses_age_range"),
        ({"currency": "USD"}, "ck_courses_currency_known"),
    ],
    ids=[
        "blank title",
        "no place",
        "501 places",
        "negative price",
        "absurd price",
        "ages reversed",
        "adult age",
        "other currency",
    ],
)
def test_the_database_keeps_a_course_sensible(changes, constraint):
    with SessionLocal() as db:
        db.add(make_course(**changes))
        with pytest.raises(IntegrityError, match=constraint):
            db.commit()


def test_a_course_starts_closed_unless_it_is_opened():
    with SessionLocal() as db:
        db.execute(text("DELETE FROM courses"))
        db.execute(
            text(
                "INSERT INTO courses (id, title, start_date, schedule, location, age_min, age_max, "
                "price_minor, second_child_price_minor, capacity) "
                "VALUES (gen_random_uuid(), 'A', '2026-12-05', 'x', 'y', 8, 13, 1, 1, 5)"
            )
        )
        db.commit()
        assert db.scalar(select(Course.registration_open)) is False
        assert db.scalar(select(func.count()).select_from(Course)) == 1
