"""Staff work on applications (SEC-B-04, SEC-B-09, SEC-B-10)."""

import csv
import io
import threading
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.db import SessionLocal
from app.models import AdminRole, Application, ApplicationNote, ApplicationStatus, AuditEntry, Child
from app.panel.services import applications as service
from app.panel.services import audit as audit_module
from tests.factories import DEFAULT_COURSE_ID, add_course, add_family
from tests.panel.support import Browser, principal_of
from tests.test_course_rules import wait_until_a_session_waits_for_a_lock

BASE = "/api/admin/applications"
SEARCH = f"{BASE}/search"
T0 = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)


def search(browser: Browser, **body):
    return browser.post(SEARCH, json=body)


def names_of(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["parent_name"] for item in response.json()["items"]]


def audit(action: str) -> list[AuditEntry]:
    with SessionLocal() as db:
        return list(db.scalars(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id)))


def stored_status(application_id: uuid.UUID) -> str:
    with SessionLocal() as db:
        return db.scalars(select(Application.status).where(Application.id == application_id)).one()


@pytest.fixture
def three_families() -> dict[str, uuid.UUID]:
    return {
        "aysel": add_family(
            "Aysel Məmmədova",
            "+994 50 123 45 67",
            children=[("Leyla", date(2016, 3, 14))],
            languages=["Azərbaycan"],
            created_at=T0,
        ),
        "rashad": add_family(
            "Rəşad Əliyev",
            "055 765 43 21",
            children=[("Tural", date(2014, 11, 2)), ("Nigar", date(2017, 5, 5))],
            languages=["Rus", "İngilis"],
            status="contacted",
            created_at=T0 + timedelta(hours=1),
        ),
        "ulviyya": add_family(
            "ÜLVİYYƏ Həsənova",
            "+994 70 111 22 33",
            children=[("Aydan", date(2015, 1, 1))],
            languages=["İngilis"],
            status="approved",
            created_at=T0 + timedelta(hours=2),
        ),
    }


# --- the list


def test_the_list_is_newest_first_and_paginated(admin, three_families):
    first_page = search(admin, limit=2).json()

    assert [item["parent_name"] for item in first_page["items"]] == ["ÜLVİYYƏ Həsənova", "Rəşad Əliyev"]
    assert (first_page["total"], first_page["limit"], first_page["offset"]) == (3, 2, 0)
    assert names_of(search(admin, limit=2, offset=2)) == ["Aysel Məmmədova"]
    assert names_of(search(admin, sort="oldest")) == ["Aysel Məmmədova", "Rəşad Əliyev", "ÜLVİYYƏ Həsənova"]


@pytest.mark.parametrize(
    "body", [{"limit": 101}, {"limit": 0}, {"offset": -1}, {"search": "x" * 101}, {"sort": "any"}]
)
def test_the_limits_of_a_search_are_enforced(admin, body):
    assert search(admin, **body).status_code == 422


@pytest.mark.parametrize(
    "dates",
    [
        {"created_to": "9999-12-31"},  # one day later is past the end of what a date can hold
        {"created_from": "0001-01-01"},
        {"created_from": "2019-12-31"},
        {"created_to": "2101-01-01"},
    ],
    ids=repr,
)
def test_a_date_in_a_filter_stays_within_a_sane_range_for_a_search_and_an_export(admin, dates):
    assert search(admin, **dates).status_code == 422
    assert admin.post(f"{BASE}/export", json=dates).status_code == 422


def test_an_application_in_the_list_carries_what_staff_need_to_call_the_family(admin, three_families):
    item = search(admin, search="Rəşad").json()["items"][0]

    assert item["phone"] == "055 765 43 21"
    assert item["status"] == "contacted"
    assert item["languages"] == ["Rus", "İngilis"]
    assert item["course"] == {
        "id": str(DEFAULT_COURSE_ID),
        "title": "Test course",
        "start_date": "2026-12-05",
    }
    assert [(child["name"], child["age_at_course_start"]) for child in item["children"]] == [
        ("Tural", 12),
        ("Nigar", 9),
    ]
    assert item["notes_count"] == 0


@pytest.mark.parametrize(
    ("children", "expected"),
    [
        # An application brings one or two children (the database allows no more).
        ([("Too young", date(2019, 1, 1)), ("Just old enough", date(2012, 12, 6))], [(7, False), (13, True)]),
        ([("Too old", date(2012, 12, 5))], [(14, False)]),
    ],
)
def test_a_child_outside_the_age_range_of_the_course_is_marked(admin, children, expected):
    add_family(children=children)

    shown = search(admin).json()["items"][0]["children"]

    assert [(child["age_at_course_start"], child["within_age_range"]) for child in shown] == expected


# --- finding (search and filters)


@pytest.mark.parametrize(
    ("term", "expected"),
    [
        ("aysel", ["Aysel Məmmədova"]),  # case does not matter
        ("AYSEL", ["Aysel Məmmədova"]),
        ("məmməd", ["Aysel Məmmədova"]),  # nor does a letter of the Azerbaijani alphabet
        ("əli", ["Rəşad Əliyev"]),
        ("ƏLİYEV", ["Rəşad Əliyev"]),
        ("ülviyyə", ["ÜLVİYYƏ Həsənova"]),
        ("tural", ["Rəşad Əliyev"]),  # a child's name finds the family
        ("nigar", ["Rəşad Əliyev"]),
        ("0507654321", []),  # a number that is nobody's
        ("050 123", ["Aysel Məmmədova"]),  # a part of a number, written the way a person writes it
        ("994501234567", ["Aysel Məmmədova"]),
        ("055-765-43-21", ["Rəşad Əliyev"]),
        ("+994 55 765", ["Rəşad Əliyev"]),
        ("zzz", []),
    ],
)
def test_search_finds_a_name_or_a_phone_number_however_it_is_written(admin, three_families, term, expected):
    assert sorted(names_of(search(admin, search=term))) == sorted(expected)


@pytest.mark.parametrize("term", ["%", "_", "\\", "%%", "A%l"])
def test_search_treats_wildcard_characters_as_plain_text(admin, three_families, term):
    assert names_of(search(admin, search=term)) == []


def test_search_matches_a_wildcard_character_that_is_really_in_a_name(admin):
    add_family("100% Real_Name")

    assert names_of(search(admin, search="100%")) == ["100% Real_Name"]
    assert names_of(search(admin, search="l_N")) == ["100% Real_Name"]


def test_search_can_be_filtered_by_status(admin, three_families):
    assert names_of(search(admin, statuses=["new"])) == ["Aysel Məmmədova"]
    found = names_of(search(admin, statuses=["contacted", "approved"]))
    assert sorted(found) == sorted(["ÜLVİYYƏ Həsənova", "Rəşad Əliyev"])
    assert search(admin, statuses=["archived"]).status_code == 422


def test_search_can_be_filtered_by_language_and_course(admin, three_families):
    other_course = add_course(title="Spring group")
    add_family("Spring Family", course_id=other_course, languages=["Rus"])

    found = names_of(search(admin, language="İngilis"))
    assert sorted(found) == sorted(["ÜLVİYYƏ Həsənova", "Rəşad Əliyev"])
    assert names_of(search(admin, course_id=str(other_course))) == ["Spring Family"]
    assert search(admin, language="Fransız").status_code == 422


def test_the_dates_of_a_filter_are_days_in_baku(admin):
    # 21:30 UTC on the 1st is 01:30 on the 2nd in Baku (UTC+4).
    add_family("After midnight", created_at=datetime(2026, 11, 1, 21, 30, tzinfo=UTC))
    add_family("Before midnight", created_at=datetime(2026, 11, 1, 19, 59, tzinfo=UTC))

    assert names_of(search(admin, created_from="2026-11-02", created_to="2026-11-02")) == ["After midnight"]
    assert names_of(search(admin, created_to="2026-11-01")) == ["Before midnight"]
    assert names_of(search(admin, created_from="2026-11-03")) == []


def test_filters_work_together(admin, three_families):
    assert names_of(search(admin, search="a", statuses=["approved"], language="İngilis")) == [
        "ÜLVİYYƏ Həsənova"
    ]
    assert names_of(search(admin, search="a", statuses=["new"], language="İngilis")) == []


# --- reading one application


def test_reading_an_application_shows_the_consent_and_the_notice_it_was_given_for(admin, three_families):
    detail = admin.get(f"{BASE}/{three_families['aysel']}").json()

    assert detail["privacy_notice_version"] == "2026-10-19"
    assert detail["consent_given_at"] == "2026-11-01T08:00:00Z"
    assert detail["status_changed_at"] is None
    assert detail["notes"] == []


def test_an_application_from_before_the_consent_record_shows_it_as_empty(admin):
    with SessionLocal() as db:
        db.add(
            Application(
                parent_name="Old", phone="+994 50 000 00 01", languages=["Rus"], course_id=DEFAULT_COURSE_ID
            )
        )
        db.commit()

    detail = search(admin).json()["items"][0]
    full = admin.get(f"{BASE}/{detail['id']}").json()

    assert (full["consent_given_at"], full["privacy_notice_version"]) == (None, None)


def test_an_unknown_application_is_not_found(admin):
    assert admin.get(f"{BASE}/{uuid.uuid4()}").status_code == 404
    assert admin.get(f"{BASE}/not-a-uuid").status_code == 422


def test_every_read_of_personal_data_is_audited_without_the_data(admin, three_families):
    search(admin, search="Rəşad", statuses=["contacted"])
    admin.get(f"{BASE}/{three_families['aysel']}")

    (listed,) = audit("applications_listed")
    (viewed,) = audit("application_viewed")
    assert listed.admin_email == admin.staff.email
    assert listed.detail == {
        "searched": True,
        "statuses": ["contacted"],
        "course_id": None,
        "language": None,
        "created_from": None,
        "created_to": None,
        "returned": 1,
        "offset": 0,
        "total": 1,
        "ids": [str(three_families["rashad"])],  # whose details were shown, as ids and nothing else
    }
    assert (viewed.entity_type, viewed.entity_id) == ("application", str(three_families["aysel"]))
    everything = str(
        [
            (entry.detail, entry.entity_id)
            for entry in audit("applications_listed") + audit("application_viewed")
        ]
    )
    for personal in ("Rəşad", "Aysel", "Leyla", "50 123", "055"):
        assert personal not in everything


# --- changing the status


def test_a_coordinator_moves_an_application_from_new_to_contacted(sign_in_as, three_families):
    coordinator = sign_in_as(AdminRole.COORDINATOR)

    response = coordinator.patch(f"{BASE}/{three_families['aysel']}", json={"status": "contacted"})

    assert response.status_code == 200
    assert response.json()["status"] == "contacted"
    assert response.json()["status_changed_at"] is not None
    assert stored_status(three_families["aysel"]) == "contacted"
    (entry,) = audit("application_status_changed")
    assert entry.detail == {"from": "new", "to": "contacted"}


def test_setting_the_status_it_already_has_changes_and_records_nothing(admin, three_families):
    response = admin.patch(f"{BASE}/{three_families['aysel']}", json={"status": "new"})

    assert response.status_code == 200
    assert response.json()["status_changed_at"] is None
    assert audit("application_status_changed") == []


def test_a_coordinator_cannot_take_an_approval_back_but_an_admin_can(sign_in_as, three_families):
    # The retention job deletes applications that are not approved once they are old enough: leaving
    # `approved` is an erasure in effect, so it needs the right to erase (SEC-B-04, SEC-B-09).
    coordinator, admin = sign_in_as(AdminRole.COORDINATOR), sign_in_as(AdminRole.ADMIN)
    approved = three_families["ulviyya"]

    refused = coordinator.patch(f"{BASE}/{approved}", json={"status": "declined"})

    assert refused.status_code == 403
    assert refused.json()["code"] == "approval_locked"
    assert stored_status(approved) == "approved"
    assert audit("application_status_changed") == []
    assert admin.patch(f"{BASE}/{approved}", json={"status": "declined"}).status_code == 200
    assert stored_status(approved) == "declined"


def test_a_coordinator_still_approves_and_repeating_an_approval_is_harmless(sign_in_as, three_families):
    coordinator = sign_in_as(AdminRole.COORDINATOR)
    aysel = three_families["aysel"]

    assert coordinator.patch(f"{BASE}/{aysel}", json={"status": "approved"}).status_code == 200
    assert coordinator.patch(f"{BASE}/{aysel}", json={"status": "approved"}).status_code == 200
    assert stored_status(aysel) == "approved"
    assert len(audit("application_status_changed")) == 1


def test_two_status_changes_at_once_are_recorded_one_after_the_other(three_families, make_staff, monkeypatch):
    # The row is locked while it is read for a change, so the second change sees what the first one left.
    principal = principal_of(make_staff(AdminRole.COORDINATOR))
    application_id = three_families["aysel"]
    changed_but_not_committed = threading.Event()
    go_on = threading.Event()
    real_record = audit_module.record

    def record_then_wait(db, event):
        real_record(db, event)
        if threading.current_thread().name == "first":
            changed_but_not_committed.set()
            assert go_on.wait(10)

    monkeypatch.setattr(audit_module, "record", record_then_wait)

    def change(status: ApplicationStatus) -> None:
        with SessionLocal() as db:
            service.change_status(db, principal, application_id, status, T0)

    first = threading.Thread(target=change, args=(ApplicationStatus.CONTACTED,), name="first")
    second = threading.Thread(target=change, args=(ApplicationStatus.DECLINED,), name="second")
    first.start()
    assert changed_but_not_committed.wait(10)
    second.start()
    wait_until_a_session_waits_for_a_lock()
    go_on.set()
    first.join(10)
    second.join(10)

    assert [entry.detail for entry in audit("application_status_changed")] == [
        {"from": "new", "to": "contacted"},
        {"from": "contacted", "to": "declined"},
    ]
    assert stored_status(application_id) == "declined"


@pytest.mark.parametrize("status", ["enrolled", "archived", "", None, 3])
def test_only_the_four_statuses_can_be_set(admin, three_families, status):
    assert admin.patch(f"{BASE}/{three_families['aysel']}", json={"status": status}).status_code == 422


def test_an_unknown_application_cannot_be_updated(admin):
    assert admin.patch(f"{BASE}/{uuid.uuid4()}", json={"status": "contacted"}).status_code == 404


def test_approving_takes_seats_and_a_full_course_refuses_with_the_numbers(admin):
    course = add_course(capacity=2)
    first = add_family("First", course_id=course, children=[("A", date(2016, 1, 1)), ("B", date(2017, 1, 1))])
    second = add_family("Second", course_id=course, children=[("C", date(2016, 1, 1))])

    assert admin.patch(f"{BASE}/{first}", json={"status": "approved"}).status_code == 200
    refused = admin.patch(f"{BASE}/{second}", json={"status": "approved"})

    assert refused.status_code == 409
    assert refused.json()["code"] == "not_enough_seats"
    assert (refused.json()["needed"], refused.json()["free_seats"]) == (1, 0)
    assert stored_status(second) == "new"
    assert audit("application_status_changed")[-1].detail == {"from": "new", "to": "approved"}
    assert len(audit("application_status_changed")) == 1  # the refused change left no trace of success


def test_declining_an_approved_application_frees_its_seats(admin):
    course = add_course(capacity=1)
    first, second = add_family("First", course_id=course), add_family("Second", course_id=course)
    admin.patch(f"{BASE}/{first}", json={"status": "approved"})
    assert admin.patch(f"{BASE}/{second}", json={"status": "approved"}).status_code == 409

    admin.patch(f"{BASE}/{first}", json={"status": "declined"})

    assert admin.patch(f"{BASE}/{second}", json={"status": "approved"}).status_code == 200


# --- notes


def test_a_note_is_added_with_its_author_and_shown_with_the_application(sign_in_as, three_families):
    coordinator = sign_in_as(AdminRole.COORDINATOR)

    created = coordinator.post(
        f"{BASE}/{three_families['aysel']}/notes", json={"body": "  Called, will decide on Friday.  "}
    )

    assert created.status_code == 201
    assert created.json()["body"] == "Called, will decide on Friday."
    assert created.json()["author"] == "Test Staff"
    detail = coordinator.get(f"{BASE}/{three_families['aysel']}").json()
    assert [note["body"] for note in detail["notes"]] == ["Called, will decide on Friday."]
    assert detail["notes_count"] == 1
    (entry,) = audit("application_note_added")
    assert "Friday" not in str(entry.detail) + str(entry.entity_id)


@pytest.mark.parametrize("body", ["", "   ", "x" * 2001, None, 5, "a\x00b", "red\x1b[31m"])
def test_a_note_must_have_text_of_reasonable_length(admin, three_families, body):
    # A NUL cannot be stored in a text column: it must be refused as a 422, not end in a 500.
    assert admin.post(f"{BASE}/{three_families['aysel']}/notes", json={"body": body}).status_code == 422


def test_a_note_may_have_line_breaks_and_tabs(admin, three_families):
    body = "First line\n\tsecond line\r\nthird"

    created = admin.post(f"{BASE}/{three_families['aysel']}/notes", json={"body": body})

    assert created.status_code == 201
    assert created.json()["body"] == body


def test_a_note_of_the_longest_length_is_accepted(admin, three_families):
    assert admin.post(f"{BASE}/{three_families['aysel']}/notes", json={"body": "x" * 2000}).status_code == 201


def test_an_application_takes_a_limited_number_of_notes(admin, three_families, monkeypatch):
    monkeypatch.setattr("app.panel.services.applications.MAX_NOTES_PER_APPLICATION", 2)
    url = f"{BASE}/{three_families['aysel']}/notes"
    assert [admin.post(url, json={"body": "A note."}).status_code for _ in range(2)] == [201, 201]

    refused = admin.post(url, json={"body": "One too many."})

    assert (refused.status_code, refused.json()["code"], refused.json()["maximum"]) == (
        409,
        "too_many_notes",
        2,
    )
    assert len(admin.get(f"{BASE}/{three_families['aysel']}").json()["notes"]) == 2
    other_family = f"{BASE}/{three_families['rashad']}/notes"
    assert admin.post(other_family, json={"body": "A note."}).status_code == 201  # each has its own count


def test_a_note_for_an_unknown_application_is_not_found(admin):
    assert admin.post(f"{BASE}/{uuid.uuid4()}/notes", json={"body": "Hello"}).status_code == 404


def test_only_an_admin_takes_a_note_back_and_only_through_its_own_application(sign_in_as, three_families):
    coordinator, admin = sign_in_as(AdminRole.COORDINATOR), sign_in_as(AdminRole.ADMIN)
    note_id = coordinator.post(f"{BASE}/{three_families['aysel']}/notes", json={"body": "Hello"}).json()["id"]

    assert coordinator.delete(f"{BASE}/{three_families['aysel']}/notes/{note_id}").status_code == 403
    assert (
        admin.delete(f"{BASE}/{three_families['rashad']}/notes/{note_id}").status_code == 404
    )  # another family
    assert admin.delete(f"{BASE}/{three_families['aysel']}/notes/{note_id}").status_code == 204
    assert admin.delete(f"{BASE}/{three_families['aysel']}/notes/{note_id}").status_code == 404
    assert len(audit("application_note_deleted")) == 1


# --- erasing a family's data


def test_an_erasure_must_be_confirmed(admin, three_families):
    assert admin.delete(f"{BASE}/{three_families['aysel']}").status_code == 422
    assert admin.delete(f"{BASE}/{three_families['aysel']}?confirm=false").status_code == 422
    assert admin.delete(f"{BASE}/{three_families['aysel']}").json()["code"] == "confirmation_required"
    assert stored_status(three_families["aysel"]) == "new"


def test_an_erasure_removes_the_application_its_children_and_its_notes_for_real(admin, three_families):
    admin.post(f"{BASE}/{three_families['rashad']}/notes", json={"body": "Hello"})

    response = admin.delete(f"{BASE}/{three_families['rashad']}?confirm=true")

    assert response.status_code == 204
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Application)) == 2
        assert db.scalar(select(func.count()).select_from(Child)) == 2
        assert db.scalar(select(func.count()).select_from(ApplicationNote)) == 0
    (entry,) = audit("application_deleted")
    assert entry.detail == {"status": "contacted", "course_id": str(DEFAULT_COURSE_ID)}
    assert "Rəşad" not in str(entry.detail)
    assert admin.get(f"{BASE}/{three_families['rashad']}").status_code == 404


def test_erasing_an_unknown_application_is_not_found(admin):
    assert admin.delete(f"{BASE}/{uuid.uuid4()}?confirm=true").status_code == 404


def test_erasing_an_approved_application_gives_its_seats_back(admin):
    course = add_course(capacity=1)
    waiting = add_family("B", course_id=course)  # a full course takes no more applications: this one first
    approved = add_family("A", course_id=course, status="approved")
    assert admin.patch(f"{BASE}/{waiting}", json={"status": "approved"}).status_code == 409

    admin.delete(f"{BASE}/{approved}?confirm=true")

    assert admin.patch(f"{BASE}/{waiting}", json={"status": "approved"}).status_code == 200


# --- the roles (SEC-B-04)


@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        (
            AdminRole.VIEWER,
            {
                "search": 200,
                "read": 200,
                "pulse": 200,
                "update": 403,
                "note": 403,
                "export": 403,
                "erase": 403,
            },
        ),
        (
            AdminRole.COORDINATOR,
            {
                "search": 200,
                "read": 200,
                "pulse": 200,
                "update": 200,
                "note": 201,
                "export": 403,
                "erase": 403,
            },
        ),
        (
            AdminRole.ADMIN,
            {
                "search": 200,
                "read": 200,
                "pulse": 200,
                "update": 200,
                "note": 201,
                "export": 200,
                "erase": 204,
            },
        ),
    ],
    ids=lambda value: getattr(value, "value", ""),
)
def test_each_role_may_do_exactly_what_it_is_for(sign_in_as, role, allowed):
    family = add_family()
    browser = sign_in_as(role)
    url = f"{BASE}/{family}"

    outcome = {
        "search": search(browser).status_code,
        "read": browser.get(url).status_code,
        "pulse": browser.get(f"{BASE}/pulse").status_code,
        "update": browser.patch(url, json={"status": "contacted"}).status_code,
        "note": browser.post(f"{url}/notes", json={"body": "Hi"}).status_code,
        "export": browser.post(f"{BASE}/export", json={}).status_code,
        "erase": browser.delete(f"{url}?confirm=true").status_code,
    }

    assert outcome == allowed


# --- the pulse (what a page polls for)


def test_the_pulse_counts_applications_and_names_the_latest(admin, three_families):
    pulse = admin.get(f"{BASE}/pulse").json()

    assert pulse == {
        "applications_total": 3,
        "new_applications": 1,
        "latest_application_at": "2026-11-01T10:00:00Z",
    }


def test_the_pulse_of_an_empty_system(admin):
    assert admin.get(f"{BASE}/pulse").json() == {
        "applications_total": 0,
        "new_applications": 0,
        "latest_application_at": None,
    }


# --- the export (SEC-B-09: rare, justified, logged)


def read_csv(response) -> list[list[str]]:
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="muracietler-2026-11-02.csv"'
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"\xef\xbb\xbf")  # the byte order mark Excel needs for UTF-8
    return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))


def test_the_export_holds_one_row_per_application_with_the_consent(admin, three_families):
    rows = read_csv(admin.post(f"{BASE}/export", json={"statuses": ["contacted"]}))

    assert rows[0][:5] == ["ID", "Tarix", "Status", "Valideyn", "Telefon"]
    assert rows[1] == [
        str(three_families["rashad"]),
        "2026-11-01 13:00",  # 09:00 UTC is 13:00 in Baku
        "Əlaqə saxlanılıb",
        "Rəşad Əliyev",
        "055 765 43 21",
        "Tural",
        "2014-11-02",
        "Nigar",
        "2017-05-05",
        "Rus, İngilis",
        "Test course",
        "2026-11-01 13:00",
        "2026-10-19",
    ]
    assert len(rows) == 2


def test_a_cell_that_a_spreadsheet_would_run_as_a_formula_is_defused(admin):
    add_family(
        '=HYPERLINK("http://evil.example","click")',
        phone="+994 50 123 45 67",
        children=[("@SUM(1+1)", date(2016, 1, 1))],
    )
    add_family("-2+3", children=[("\tTab", date(2016, 1, 1))])
    add_family("\rCarriage return first", children=[("\r\nSecond line", date(2016, 1, 1))])

    rows = read_csv(admin.post(f"{BASE}/export", json={}))[1:]

    cells = [cell for row in rows for cell in row]
    assert not [cell for cell in cells if cell.startswith(("=", "@", "-", "\t", "\r"))]
    assert '\'=HYPERLINK("http://evil.example","click")' in cells
    assert "'@SUM(1+1)" in cells
    assert "'-2+3" in cells
    assert "'\tTab" in cells
    assert "'\rCarriage return first" in cells  # a carriage return starts a formula in some spreadsheets too
    assert "'\r\nSecond line" in cells
    assert "'+994 50 123 45 67" in cells  # a phone number starts with +, which is a formula start too


def test_the_export_is_logged_with_how_many_rows_and_the_filters_but_no_personal_data(admin, three_families):
    admin.post(f"{BASE}/export", json={"search": "Rəşad"})

    (entry,) = audit("applications_exported")
    assert entry.detail is not None
    assert isinstance(entry.detail, dict)
    assert entry.detail["rows"] == 1
    assert entry.detail["searched"] is True
    # Which families left the system in the file: ids only, so a leaked file can be traced to its families.
    assert entry.detail["ids"] == [str(three_families["rashad"])]
    assert "Rəşad" not in str(entry.detail)


def test_an_export_of_more_rows_than_one_download_may_hold_is_refused(admin, three_families, monkeypatch):
    monkeypatch.setattr("app.panel.services.csv_export.MAX_ROWS", 2)

    refused = admin.post(f"{BASE}/export", json={})

    assert refused.status_code == 413
    assert refused.json() == {
        "detail": "Too many rows for one download.",
        "code": "too_many_rows",
        "maximum": 2,
    }
    assert audit("applications_exported") == []


def test_exports_are_limited_to_a_few_a_minute(admin):
    statuses = [admin.post(f"{BASE}/export", json={}).status_code for _ in range(7)]

    assert statuses == [200] * 5 + [429] * 2


def test_the_search_terms_of_the_panel_never_travel_in_the_address(admin, three_families):
    # A name or a number in a URL ends up in logs and in the browser history (the admin standards, rule 6).
    response = admin.client.get(f"{SEARCH}?search=Aysel")

    assert response.status_code in (404, 405, 422)
    assert "Aysel" not in response.text


@pytest.mark.parametrize("database_text", ["Aysel", "Leyla", "50 123 45 67"])
def test_the_panel_does_not_log_personal_data(admin, three_families, caplog, database_text):
    with caplog.at_level("DEBUG"):
        search(admin, search="Aysel")
        admin.get(f"{BASE}/{three_families['aysel']}")

    assert database_text not in caplog.text


def test_the_database_holds_nothing_the_panel_wrote_in_the_application_row_but_the_status(
    admin, three_families
):
    admin.patch(f"{BASE}/{three_families['aysel']}", json={"status": "declined"})

    with SessionLocal() as db:
        row = db.execute(
            text("SELECT parent_name, phone, status FROM applications WHERE id = :id"),
            {"id": three_families["aysel"]},
        ).one()
    assert tuple(row) == ("Aysel Məmmədova", "+994 50 123 45 67", "declined")
