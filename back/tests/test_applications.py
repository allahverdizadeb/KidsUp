import re
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.db import SessionLocal
from app.main import create_app
from app.models import Application, ApplicationStatus
from app.schemas.application import PUBLISHED_NOTICE_VERSIONS
from tests.conftest import make_settings

# The page's notice and its version. This module reads it, like test_compose.py reads docker-compose.yml.
FRONT_NOTICE_FILE = Path(__file__).resolve().parents[2] / "front" / "src" / "content" / "privacyNotice.ts"

VALID: dict[str, Any] = {
    "parent_name": "Aysel Məmmədova",
    "phone": "+994 50 123 45 67",
    "children": [{"name": "Leyla Məmmədova", "birth_date": "2016-03-14"}],
    "languages": ["Azərbaycan", "Rus"],
    "consent": True,
    "privacy_notice_version": "2026-10-19",
}


def with_(**changes):
    body = deepcopy(VALID)
    body.update(changes)
    return body


def test_creates_application_with_children(client):
    body = with_(
        children=[
            {"name": "Leyla Məmmədova", "birth_date": "2016-03-14"},
            {"name": "Tural Məmmədov", "birth_date": "2014-11-02"},
        ]
    )
    response = client.post("/api/applications", json=body)

    assert response.status_code == 201
    assert list(response.json()) == ["id"]
    with SessionLocal() as db:
        saved = db.scalars(select(Application)).one()
        assert saved.parent_name == "Aysel Məmmədova"
        assert saved.languages == ["Azərbaycan", "Rus"]
        assert saved.status == "new"
        assert [c.name for c in saved.children] == ["Leyla Məmmədova", "Tural Məmmədov"]


def test_trims_and_deduplicates(client):
    response = client.post(
        "/api/applications",
        json=with_(parent_name="  Aysel  ", languages=["Rus", "Rus", "İngilis"]),
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        saved = db.scalars(select(Application)).one()
        assert saved.parent_name == "Aysel"
        assert saved.languages == ["Rus", "İngilis"]


@pytest.mark.parametrize(
    "body",
    [
        with_(parent_name="   "),
        with_(phone="12345"),
        with_(phone="abc defg hijk"),
        with_(children=[]),
        with_(children=[VALID["children"][0]] * 3),
        with_(children=[{"name": "", "birth_date": "2016-03-14"}]),
        with_(children=[{"name": "Leyla", "birth_date": "1999-01-01"}]),
        with_(languages=[]),
        with_(languages=["Fransız"]),
    ],
    ids=[
        "blank parent name",
        "short phone",
        "letters as phone",
        "no children",
        "three children",
        "blank child name",
        "implausible birth date",
        "no language",
        "unknown language",
    ],
)
def test_rejects_invalid_input(client, body):
    assert client.post("/api/applications", json=body).status_code == 422
    assert stored_applications() == []


def child(name: str = "Leyla", birth_date: str = "2016-03-14") -> dict[str, str]:
    return {"name": name, "birth_date": birth_date}


# --- the limits of the contract (SEC-B-01): accepted at the edge, refused one past it


@pytest.mark.parametrize(
    ("body", "status"),
    [
        pytest.param(with_(parent_name="A" * 120), 201, id="parent name of 120 characters"),
        pytest.param(with_(parent_name="A" * 121), 422, id="parent name of 121 characters"),
        pytest.param(with_(children=[child(name="B" * 120)]), 201, id="child name of 120 characters"),
        pytest.param(with_(children=[child(name="B" * 121)]), 422, id="child name of 121 characters"),
        pytest.param(with_(phone="501234567"), 201, id="phone with 9 digits"),
        pytest.param(with_(phone="50123456"), 422, id="phone with 8 digits"),
        pytest.param(with_(phone="+994 50 123 45 67"), 201, id="phone with 12 digits"),
        pytest.param(with_(phone="+994 50 123 45 678"), 422, id="phone with 13 digits"),
        pytest.param(with_(phone="+994" + " " * 19 + "501234567"), 201, id="phone of 32 characters"),
        pytest.param(with_(phone="+994" + " " * 20 + "501234567"), 422, id="phone of 33 characters"),
        pytest.param(with_(children=[child(), child("Tural", "2014-11-02")]), 201, id="two children"),
        pytest.param(with_(children=[child(), child(), child()]), 422, id="three children"),
        pytest.param(with_(languages=["Azərbaycan", "Rus", "İngilis"]), 201, id="three languages"),
        pytest.param(with_(languages=["Azərbaycan", "Rus", "İngilis", "Rus"]), 422, id="four languages"),
        pytest.param(with_(children=[child(birth_date="2009-12-31")]), 422, id="born the day before 2010"),
        pytest.param(with_(children=[child(birth_date="2010-01-01")]), 201, id="born on 2010-01-01"),
        pytest.param(with_(children=[child(birth_date="2020-12-31")]), 201, id="born on 2020-12-31"),
        pytest.param(with_(children=[child(birth_date="2021-01-01")]), 422, id="born the day after 2020"),
    ],
)
def test_the_limits_of_the_contract_hold_at_their_edges(client, body, status):
    assert client.post("/api/applications", json=body).status_code == status


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def stored_applications() -> list[Application]:
    with SessionLocal() as db:
        return list(db.scalars(select(Application)).all())


# --- phone numbers and names: what is stored is plain text that cannot spoof a log line or an e-mail


NO_BREAK_SPACE = chr(0xA0)  # what a number copied from a messenger often has between its groups
NARROW_NO_BREAK_SPACE = chr(0x202F)


@pytest.mark.parametrize(
    "typed",
    [
        f"+994{NO_BREAK_SPACE}50 123 45 67",
        NARROW_NO_BREAK_SPACE.join(["+994", "50", "123", "45", "67"]),
        "+994  50   123 45 67",
        "+994\t50 123\n45 67",
    ],
    ids=["no-break space", "narrow no-break space", "repeated spaces", "tab and newline"],
)
def test_separators_in_a_phone_number_become_single_spaces(client, typed):
    assert client.post("/api/applications", json=with_(phone=typed)).status_code == 201
    assert stored_applications()[0].phone == "+994 50 123 45 67"


@pytest.mark.parametrize(
    "phone",
    ["٠٥٠١٢٣٤٥٦٧", "０５０１２３４５６７８", "050123456٧٨", "+994 50 123 45 67 ext 8", "+994/50/123/45/67"],
    ids=[
        "arabic-indic digits",
        "full-width digits",
        "plain digits mixed with arabic-indic",
        "letters",
        "slashes",
    ],
)
def test_a_phone_number_has_plain_digits_and_phone_characters_only(client, phone):
    assert client.post("/api/applications", json=with_(phone=phone)).status_code == 422
    assert stored_applications() == []


def test_spaces_and_tabs_inside_a_name_become_single_spaces(client):
    body = with_(
        parent_name="Aysel \t  Məmmədova",
        children=[{"name": "Leyla\n Məmmədova", "birth_date": "2016-03-14"}],
    )

    assert client.post("/api/applications", json=body).status_code == 201

    with SessionLocal() as db:
        saved = db.scalars(select(Application)).one()
        assert saved.parent_name == "Aysel Məmmədova"
        assert [child.name for child in saved.children] == ["Leyla Məmmədova"]


# Control characters, and invisible marks that reverse text direction (override, isolate, right-to-left mark).
@pytest.mark.parametrize("hidden", ["\x07", "\x00", chr(0x202E), chr(0x2066), chr(0x200F)], ids=repr)
def test_a_name_cannot_hide_control_characters_or_a_text_direction_override(client, hidden):
    for body in (
        with_(parent_name=f"Aysel{hidden}"),
        with_(children=[{"name": f"Leyla{hidden}", "birth_date": "2016-03-14"}]),
    ):
        assert client.post("/api/applications", json=body).status_code == 422
    assert stored_applications() == []


# --- consent (SEC-F-16, SEC-B-09)


def test_records_the_consent_and_the_notice_version_it_was_given_for(client):
    assert client.post("/api/applications", json=VALID).status_code == 201

    saved = stored_applications()[0]
    assert saved.privacy_notice_version == "2026-10-19"
    # The database's clock, read in the same statement as created_at: the moment the yes was received.
    assert saved.consent_given_at == saved.created_at


@pytest.mark.parametrize("consent", [False, None, 1, 0, "true", "yes"], ids=repr)
def test_refuses_an_application_without_a_clear_yes(client, consent):
    assert client.post("/api/applications", json=with_(consent=consent)).status_code == 422
    assert stored_applications() == []


@pytest.mark.parametrize("missing", ["consent", "privacy_notice_version"])
def test_refuses_an_application_without_the_consent_fields(client, missing):
    body = deepcopy(VALID)
    del body[missing]

    assert client.post("/api/applications", json=body).status_code == 422
    assert stored_applications() == []


@pytest.mark.parametrize(
    "version",
    ["", "latest", "2026-13-01", "2026-10-19-UPPER", "2026-10-19-" + "a" * 17, "../etc", "2026-10-19 draft"],
    ids=repr,
)
def test_refuses_a_notice_version_that_is_not_a_date_with_a_short_suffix(client, version):
    assert client.post("/api/applications", json=with_(privacy_notice_version=version)).status_code == 422
    assert stored_applications() == []


@pytest.mark.parametrize(
    "version", ["2026-10-19-draft", "2026-10-18", "2099-01-01", "2026-10-19-v2"], ids=repr
)  # the retired draft, the day before, the future, a suffix nobody published
def test_refuses_a_notice_version_that_was_never_published(client, version):
    # Well formed, but no parent was ever shown it: the record must not point at wording that never existed.
    assert version not in PUBLISHED_NOTICE_VERSIONS
    assert client.post("/api/applications", json=with_(privacy_notice_version=version)).status_code == 422
    assert stored_applications() == []


@pytest.mark.parametrize("version", sorted(PUBLISHED_NOTICE_VERSIONS))
def test_accepts_a_published_notice_version(client, version):
    assert client.post("/api/applications", json=with_(privacy_notice_version=version)).status_code == 201
    assert stored_applications()[0].privacy_notice_version == version


def test_the_api_knows_the_notice_version_the_page_sends():
    # A version changed on one side only would make every submission a 422: families would see the fallback.
    source = FRONT_NOTICE_FILE.read_text(encoding="utf-8")
    version = re.search(r"PRIVACY_NOTICE_VERSION = '([^']+)'", source)

    assert version is not None
    assert version.group(1) in PUBLISHED_NOTICE_VERSIONS


@pytest.mark.parametrize(
    "columns",
    [
        {"consent_given_at": func.now()},
        {"privacy_notice_version": "2026-10-19"},
    ],
    ids=["a time but no version", "a version but no time"],
)
def test_the_database_keeps_the_consent_time_and_the_notice_version_together(columns):
    # Rows from before the notice existed have neither; a row with only one of them is never valid.
    with SessionLocal() as db:
        db.add(Application(parent_name="Aysel", phone="+994 50 123 45 67", languages=["Rus"], **columns))
        with pytest.raises(IntegrityError, match="ck_applications_consent_recorded_together"):
            db.commit()


@pytest.mark.parametrize("status", list(ApplicationStatus))
def test_every_status_the_code_knows_can_be_stored(status):
    # A status added to the code without a migration would be refused by the database's CHECK.
    with SessionLocal() as db:
        db.add(Application(parent_name="Aysel", phone=VALID["phone"], languages=["Rus"], status=status.value))
        db.commit()

    assert [stored.status for stored in stored_applications()] == [status.value]


@pytest.mark.parametrize(
    "status", ["enrolled", "archived", "NEW", ""]
)  # the retired status, a stranger, a case
def test_the_database_refuses_a_status_the_code_does_not_know(status):
    # The retention job deletes by status, so an unknown one must not be storable.
    with SessionLocal() as db:
        db.add(Application(parent_name="Aysel", phone="+994 50 123 45 67", languages=["Rus"], status=status))
        with pytest.raises(IntegrityError, match="ck_applications_status_known"):
            db.commit()


# --- a database failure (SEC-B-10)


@pytest.fixture
def failing_child_insert():
    """Makes the database fail while the API stores an application, as a restart or a missing grant would."""
    with SessionLocal() as db:
        db.execute(
            text(
                "CREATE FUNCTION fail_child_insert() RETURNS trigger LANGUAGE plpgsql "
                "AS $$ BEGIN RAISE EXCEPTION 'simulated database failure'; END $$"
            )
        )
        db.execute(
            text(
                "CREATE TRIGGER fail_child_insert BEFORE INSERT ON application_children "
                "FOR EACH ROW EXECUTE FUNCTION fail_child_insert()"
            )
        )
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(text("DROP TRIGGER fail_child_insert ON application_children"))
        db.execute(text("DROP FUNCTION fail_child_insert()"))
        db.commit()


def test_a_database_error_never_carries_the_applicants_details(failing_child_insert):
    # uvicorn logs the text of an unhandled error: SQLAlchemy would append the bound parameters to it.
    client = TestClient(create_app(make_settings(rate_limit_per_minute=10_000)))

    with pytest.raises(DBAPIError) as error:
        client.post("/api/applications", json=VALID)

    assert "simulated database failure" in str(error.value)  # it is the real database error
    for personal in ("Aysel", "Məmmədova", "Leyla", "50 123 45 67", "2016-03-14"):
        assert personal not in str(error.value)
    assert stored_applications() == []
