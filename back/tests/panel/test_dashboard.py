"""The first page of the panel: every number is computed from the stored data, none is typed in."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models import AdminRole, AuditEntry
from tests.factories import add_course, add_family
from tests.panel.support import START

URL = "/api/admin/dashboard"
TODAY = START  # 2026-11-02 10:00 UTC, which is 14:00 in Baku


def at(days_ago: int, hour: int = 8) -> datetime:
    return datetime.combine(
        (TODAY - timedelta(days=days_ago)).date(), datetime.min.time(), tzinfo=UTC
    ).replace(hour=hour)


def test_an_empty_system_has_zeros_everywhere_not_made_up_numbers(admin):
    page = admin.get(URL).json()

    assert page["totals"] == {
        "applications": 0,
        "by_status": {"new": 0, "contacted": 0, "approved": 0, "declined": 0},
        "approved_children": 0,
        "free_seats": 20,  # the one course has 20 places and nobody in them
    }
    assert page["latest_applications"] == []
    assert len(page["dynamics"]) == 30
    assert {day["applications"] for day in page["dynamics"]} == {0}
    assert page["generated_at"] == "2026-11-02T10:00:00Z"


def test_the_totals_count_applications_by_status_and_participants_by_child(admin):
    add_family(status="new")
    add_family(status="new")
    add_family(status="contacted")
    add_family(status="declined")
    add_family(status="approved", children=[("x", date(2016, 1, 1)), ("y", date(2017, 1, 1))])
    add_family(status="approved")

    totals = admin.get(URL).json()["totals"]

    assert totals == {
        "applications": 6,
        "by_status": {"new": 2, "contacted": 1, "approved": 2, "declined": 1},
        "approved_children": 3,  # three children in two approved applications
        "free_seats": 17,
    }


def test_free_seats_are_counted_over_the_courses_open_for_registration_only(admin):
    add_course(capacity=10, registration_open=False)
    add_course(capacity=7, registration_open=True)
    add_family(status="approved")  # one child in the default course

    assert admin.get(URL).json()["totals"]["free_seats"] == 19 + 7


def test_the_courses_come_with_their_seats(admin):
    add_family(status="approved")

    (course,) = admin.get(URL).json()["courses"]

    assert (course["title"], course["seats"]["approved_children"], course["seats"]["free_seats"]) == (
        "Test course",
        1,
        19,
    )


def test_the_latest_applications_are_the_five_newest(admin):
    for number in range(7):
        add_family(f"Family {number}", created_at=at(days_ago=7 - number))

    latest = admin.get(URL).json()["latest_applications"]

    assert [item["parent_name"] for item in latest] == [f"Family {number}" for number in (6, 5, 4, 3, 2)]


def test_the_dynamics_count_each_day_in_baku_and_end_with_today(admin):
    add_family(created_at=at(days_ago=0, hour=7))
    add_family(created_at=at(days_ago=0, hour=9))
    add_family(created_at=at(days_ago=3))
    # 21:30 UTC the evening before is already the next morning in Baku (UTC+4): it counts for that morning.
    add_family(created_at=at(days_ago=2, hour=21).replace(minute=30))
    add_family(created_at=at(days_ago=40))  # outside the 30 days

    dynamics = admin.get(URL).json()["dynamics"]

    assert dynamics[-1] == {"day": "2026-11-02", "applications": 2}
    assert dynamics[0]["day"] == "2026-10-04"
    by_day = {entry["day"]: entry["applications"] for entry in dynamics}
    assert by_day["2026-10-30"] == 1  # three days before
    assert by_day["2026-10-31"] == 0  # 21:30 on the 31st UTC is the 1st of November in Baku...
    assert by_day["2026-11-01"] == 1  # ...so it is counted here
    assert sum(by_day.values()) == 4


@pytest.mark.parametrize(("days", "status"), [(6, 422), (7, 200), (90, 200), (91, 422), (0, 422)])
def test_the_period_of_the_dynamics_is_bounded(admin, days, status):
    response = admin.get(f"{URL}?days={days}")

    assert response.status_code == status
    if status == 200:
        assert len(response.json()["dynamics"]) == days


@pytest.mark.parametrize("role", list(AdminRole))
def test_every_role_sees_the_dashboard(sign_in_as, role):
    assert sign_in_as(role).get(URL).status_code == 200


def test_the_dashboard_is_audited_like_any_other_read_of_applications_and_holds_no_personal_data(admin):
    family = add_family("Aysel Məmmədova", phone="+994 50 123 45 67")

    admin.get(URL)

    with SessionLocal() as db:
        entries = db.scalars(select(AuditEntry).where(AuditEntry.action == "applications_listed")).all()
    assert [entry.detail for entry in entries] == [
        {"source": "dashboard", "returned": 1, "ids": [str(family)]}
    ]
    assert "Aysel" not in str(entries[0].detail)
