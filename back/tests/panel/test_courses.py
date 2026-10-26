"""Staff manage courses, and the landing page learns of every change (the courses part of the brief)."""

import json
import uuid
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models import AdminRole, AuditEntry, Course
from tests.factories import DEFAULT_COURSE_ID, add_course, add_family
from tests.panel.support import Browser

BASE = "/api/admin/courses"

NEW_COURSE = {
    "title": "Spring 2027",
    "start_date": "2027-03-06",
    "schedule": "Saturday, 10:00-13:30",
    "location": "Baku, Nasimi",
    "age_min": 8,
    "age_max": 12,
    "price_minor": 70_000,
    "second_child_price_minor": 55_000,
    "capacity": 16,
}


def public_courses(tmp_path: Path) -> list[dict[str, Any]]:
    """What the landing page would read: the file the panel keeps up to date for nginx."""
    courses: list[dict[str, Any]] = json.loads(
        (tmp_path / "content" / "courses.json").read_text(encoding="utf-8")
    )["courses"]
    return courses


def audit(action: str) -> list[AuditEntry]:
    with SessionLocal() as db:
        return list(db.scalars(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id)))


def create(admin: Browser, **changes):
    return admin.post(BASE, json={**NEW_COURSE, **changes})


# --- reading


def test_the_list_holds_the_course_the_landing_page_advertises_with_its_seats(admin):
    page = admin.get(BASE).json()

    assert (page["total"], page["limit"], page["offset"]) == (1, 50, 0)
    (course,) = page["items"]
    assert course["id"] == str(DEFAULT_COURSE_ID)
    assert course["seats"] == {
        "capacity": 20,
        "approved_children": 0,
        "free_seats": 20,
        "applications": {"new": 0, "contacted": 0, "approved": 0, "declined": 0},
    }
    assert course["accepting_applications"] is True
    assert course["currency"] == "AZN"


def test_the_seats_follow_the_approved_children_of_the_course(admin):
    add_family("A", children=[("x", date(2016, 1, 1)), ("y", date(2017, 1, 1))], status="approved")
    add_family("B", status="new")
    add_family("C", status="declined")

    seats = admin.get(f"{BASE}/{DEFAULT_COURSE_ID}").json()["seats"]

    assert (seats["approved_children"], seats["free_seats"]) == (2, 18)
    assert seats["applications"] == {"new": 1, "contacted": 0, "approved": 1, "declined": 1}


def test_a_full_course_does_not_accept_applications_though_registration_is_open(admin):
    course = add_course(capacity=1)
    add_family(course_id=course, status="approved")

    body = admin.get(f"{BASE}/{course}").json()

    assert body["registration_open"] is True
    assert body["accepting_applications"] is False
    assert body["seats"]["free_seats"] == 0


def test_the_list_is_paginated_and_newest_start_first(admin):
    older = add_course(title="Older", start_date=date(2026, 6, 6))
    newer = add_course(title="Newer", start_date=date(2027, 6, 6))

    page = admin.get(f"{BASE}?limit=2").json()

    assert [item["id"] for item in page["items"]] == [str(newer), str(DEFAULT_COURSE_ID)]
    assert page["total"] == 3
    assert [item["id"] for item in admin.get(f"{BASE}?limit=2&offset=2").json()["items"]] == [str(older)]
    assert admin.get(f"{BASE}?limit=101").status_code == 422
    assert admin.get(f"{BASE}?offset=-1").status_code == 422


def test_an_unknown_course_is_not_found(admin):
    assert admin.get(f"{BASE}/{uuid.uuid4()}").status_code == 404
    assert admin.patch(f"{BASE}/{uuid.uuid4()}", json={"title": "x"}).status_code == 404
    assert admin.delete(f"{BASE}/{uuid.uuid4()}").status_code == 404


# --- creating and editing


def test_a_new_course_starts_closed_and_nothing_is_published_for_it(admin, tmp_path):
    response = create(admin)

    assert response.status_code == 201
    body = response.json()
    assert (body["title"], body["registration_open"], body["accepting_applications"]) == (
        "Spring 2027",
        False,
        False,
    )
    assert (body["price_minor"], body["currency"], body["capacity"]) == (70_000, "AZN", 16)
    assert [course["title"] for course in public_courses(tmp_path)] == ["Test course"]  # the default one only
    assert [entry.entity_id for entry in audit("course_created")] == [body["id"]]


def test_opening_registration_puts_the_course_on_the_landing_page(admin, tmp_path):
    course_id = create(admin).json()["id"]

    response = admin.patch(f"{BASE}/{course_id}", json={"registration_open": True})

    assert response.status_code == 200
    published = {course["title"]: course for course in public_courses(tmp_path)}
    assert published["Spring 2027"] == {
        "id": course_id,
        "title": "Spring 2027",
        "start_date": "2027-03-06",
        "schedule": "Saturday, 10:00-13:30",
        "location": "Baku, Nasimi",
        "age_min": 8,
        "age_max": 12,
        "price_minor": 70_000,
        "second_child_price_minor": 55_000,
        "currency": "AZN",
        "capacity": 16,
        "seats_left": 16,
        "accepting_applications": True,
    }
    assert [course["title"] for course in public_courses(tmp_path)] == [
        "Test course",
        "Spring 2027",
    ]  # by start date


def test_closing_registration_takes_the_course_off_the_landing_page(admin, tmp_path):
    admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"registration_open": False})

    assert public_courses(tmp_path) == []


def test_editing_the_price_and_the_date_reaches_the_landing_page_and_is_audited(admin, tmp_path):
    response = admin.patch(
        f"{BASE}/{DEFAULT_COURSE_ID}",
        json={"price_minor": 80_000, "second_child_price_minor": 60_000, "start_date": "2027-01-16"},
    )

    assert response.status_code == 200
    (published,) = public_courses(tmp_path)
    assert (published["price_minor"], published["second_child_price_minor"], published["start_date"]) == (
        80_000,
        60_000,
        "2027-01-16",
    )
    (entry,) = audit("course_updated")
    assert entry.detail == {
        "changes": {
            "price_minor": [65_000, 80_000],
            "second_child_price_minor": [50_000, 60_000],
            "start_date": ["2026-12-05", "2027-01-16"],
        }
    }


def test_a_patch_that_changes_nothing_records_nothing(admin):
    admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"title": "Test course", "capacity": 20})

    assert audit("course_updated") == []


def test_a_course_may_have_an_end_date_and_the_landing_page_does_not_get_it(admin, tmp_path):
    created = create(admin, end_date="2027-06-12", registration_open=True).json()

    assert created["end_date"] == "2027-06-12"
    assert admin.get(f"{BASE}/{created['id']}").json()["end_date"] == "2027-06-12"
    assert create(admin).json()["end_date"] is None  # it is optional
    published = next(course for course in public_courses(tmp_path) if course["id"] == created["id"])
    assert "end_date" not in published  # the landing page's file keeps the shape it always had


def test_the_end_date_can_be_set_changed_and_taken_back_and_each_change_is_audited(admin):
    url = f"{BASE}/{DEFAULT_COURSE_ID}"

    assert admin.patch(url, json={"end_date": "2027-02-27"}).json()["end_date"] == "2027-02-27"
    assert admin.patch(url, json={"end_date": "2027-03-13"}).json()["end_date"] == "2027-03-13"
    assert admin.patch(url, json={"capacity": 25}).json()["end_date"] == "2027-03-13"  # left alone
    assert admin.patch(url, json={"end_date": None}).json()["end_date"] is None
    # Taking back what is not there is not a change: it answers 200 and writes nothing to the log.
    assert admin.patch(url, json={"end_date": None}).status_code == 200

    assert [entry.detail for entry in audit("course_updated")] == [
        {"changes": {"end_date": [None, "2027-02-27"]}},
        {"changes": {"end_date": ["2027-02-27", "2027-03-13"]}},
        {"changes": {"capacity": [20, 25]}},
        {"changes": {"end_date": ["2027-03-13", None]}},
    ]


def test_a_course_cannot_end_before_it_starts_whichever_date_is_edited(admin):
    url = f"{BASE}/{DEFAULT_COURSE_ID}"  # starts 2026-12-05

    earlier = admin.patch(url, json={"end_date": "2026-12-04"})
    assert (earlier.status_code, earlier.json()["code"], earlier.json()["field"]) == (
        422,
        "invalid_course",
        "end_date",
    )
    assert admin.patch(url, json={"end_date": "2026-12-05"}).status_code == 200  # the same day is fine
    later_start = admin.patch(url, json={"start_date": "2026-12-06"})
    assert (later_start.status_code, later_start.json()["code"]) == (422, "invalid_course")
    assert admin.patch(url, json={"start_date": "2026-12-06", "end_date": "2026-12-20"}).status_code == 200
    assert admin.get(url).json()["start_date"] == "2026-12-06"


def test_the_seats_left_on_the_landing_page_follow_the_approvals(admin, tmp_path):
    family = add_family(children=[("x", date(2016, 1, 1)), ("y", date(2017, 1, 1))])

    admin.patch(f"/api/admin/applications/{family}", json={"status": "approved"})
    assert public_courses(tmp_path)[0]["seats_left"] == 18
    admin.patch(f"/api/admin/applications/{family}", json={"status": "declined"})
    assert public_courses(tmp_path)[0]["seats_left"] == 20


def test_a_full_course_stays_on_the_landing_page_marked_as_not_accepting(admin, tmp_path):
    course = add_course(capacity=1)
    family = add_family(course_id=course)

    admin.patch(f"/api/admin/applications/{family}", json={"status": "approved"})

    full = next(item for item in public_courses(tmp_path) if item["id"] == str(course))
    assert (full["seats_left"], full["accepting_applications"]) == (0, False)


def test_the_capacity_cannot_be_lowered_below_the_children_already_approved(admin):
    course = add_course(capacity=5)
    add_family(
        course_id=course, status="approved", children=[("x", date(2016, 1, 1)), ("y", date(2017, 1, 1))]
    )

    refused = admin.patch(f"{BASE}/{course}", json={"capacity": 1})

    assert refused.status_code == 409
    assert refused.json()["code"] == "capacity_below_approved"
    assert refused.json()["approved_children"] == 2
    assert admin.patch(f"{BASE}/{course}", json={"capacity": 2}).status_code == 200


def test_the_ages_must_stay_in_order_when_one_of_them_is_edited(admin):
    refused = admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"age_min": 14})

    assert refused.status_code == 422
    assert refused.json()["code"] == "invalid_course"
    assert admin.get(f"{BASE}/{DEFAULT_COURSE_ID}").json()["age_min"] == 8


@pytest.mark.parametrize(
    "changes",
    [
        {"title": ""},
        {"title": "x" * 121},
        {"title": "Spring\x00 2027"},  # a NUL cannot be stored: it must be a 422, not a 500
        {"title": "Spring\n2027"},
        {"title": "Spring" + chr(0x202E) + "7202"},  # a text-direction override shows it back to front
        {"location": "Baku" + chr(0x2066) + "Nasimi"},
        {"schedule": "Satur" + chr(0x0085) + "day"},  # a control character of the second block
        {"schedule": "  "},
        {"schedule": "Saturday\x1b[31m"},
        {"location": "x" * 201},
        {"location": "Baku\x00"},
        {"capacity": 0},
        {"capacity": 501},
        {"price_minor": -1},
        {"price_minor": 10_000_001},
        {"second_child_price_minor": 1.5},
        {"capacity": "16"},
        {"price_minor": 700.0},
        {"age_min": -1},
        {"age_max": 26},
        {"age_min": 13, "age_max": 8},
        {"start_date": "1999-01-01"},
        {"start_date": "next saturday"},
        {"end_date": "2027-03-05"},  # the day before it starts
        {"end_date": "1999-01-01"},
        {"end_date": "2101-01-01"},
        {"end_date": "soon"},
        {"registration_open": "yes"},
        {"currency": "USD"},
        {"id": str(uuid.uuid4())},
        {"surprise": 1},
    ],
    ids=repr,
)
def test_a_course_with_values_the_rules_do_not_allow_is_refused(admin, changes):
    assert create(admin, **changes).status_code == 422
    assert len(admin.get(BASE).json()["items"]) == 1


def test_a_refusal_names_the_field_and_the_kind_of_fault_never_the_value_or_a_made_up_key(admin):
    made_up_key = "k" * 500

    refused = create(admin, title="Spring\x00 2027", **{made_up_key: "Fake-Value-Sent"})

    assert refused.status_code == 422
    assert "Fake-Value-Sent" not in refused.text
    assert "Spring" not in refused.text
    faults = refused.json()["detail"]
    assert all(set(fault) == {"loc", "type"} for fault in faults)
    assert ["body", "title"] in [fault["loc"] for fault in faults]
    assert ["body", "k" * 64] in [fault["loc"] for fault in faults]  # a name the caller made up is cut short


def test_a_field_the_api_does_not_know_is_refused_when_editing_too(admin):
    assert admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"currency": "USD"}).status_code == 422
    assert admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"id": str(uuid.uuid4())}).status_code == 422


def test_the_values_at_the_edge_of_the_rules_are_accepted(admin):
    response = create(
        admin, capacity=500, price_minor=0, second_child_price_minor=10_000_000, age_min=0, age_max=25
    )

    assert response.status_code == 201


# --- deleting


def test_a_course_nobody_applied_to_can_be_deleted_and_leaves_the_landing_page(admin, tmp_path):
    course_id = create(admin, registration_open=True).json()["id"]
    assert len(public_courses(tmp_path)) == 2

    assert admin.delete(f"{BASE}/{course_id}").status_code == 204

    assert [course["title"] for course in public_courses(tmp_path)] == ["Test course"]
    assert [entry.entity_id for entry in audit("course_deleted")] == [course_id]
    assert admin.get(f"{BASE}/{course_id}").status_code == 404


def test_a_course_with_applications_cannot_be_deleted_only_closed(admin):
    add_family()

    refused = admin.delete(f"{BASE}/{DEFAULT_COURSE_ID}")

    assert refused.status_code == 409
    assert refused.json()["code"] == "course_has_applications"
    with SessionLocal() as db:
        assert db.get(Course, DEFAULT_COURSE_ID) is not None
    assert audit("course_deleted") == []
    assert admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"registration_open": False}).status_code == 200


# --- the roles


@pytest.mark.parametrize(
    ("role", "reads", "writes"),
    [
        (AdminRole.VIEWER, 200, 403),
        (AdminRole.COORDINATOR, 200, 403),
        (AdminRole.ADMIN, 200, 201),
    ],
)
def test_everybody_reads_courses_and_only_an_admin_changes_them(sign_in_as, role, reads, writes):
    browser = sign_in_as(role)

    assert browser.get(BASE).status_code == reads
    assert browser.post(BASE, json=NEW_COURSE).status_code == writes
    if role is not AdminRole.ADMIN:
        assert browser.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"title": "x"}).status_code == 403
        assert browser.delete(f"{BASE}/{DEFAULT_COURSE_ID}").status_code == 403


# --- the landing page keeps working when the file cannot be written


def test_a_change_is_saved_even_when_the_public_file_cannot_be_written(admin, tmp_path, caplog):
    (tmp_path / "content").write_text("a file where the directory should be", encoding="utf-8")

    response = admin.patch(f"{BASE}/{DEFAULT_COURSE_ID}", json={"title": "Still saved"})

    assert response.status_code == 200
    assert admin.get(f"{BASE}/{DEFAULT_COURSE_ID}").json()["title"] == "Still saved"
    assert "the list of open courses could not be written" in caplog.text
