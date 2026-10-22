"""Staff change the landing page: save a draft, publish it, and the file the page reads follows."""

import json
import threading
import uuid
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal
from app.models import AdminRole, AuditEntry, MediaAsset, SiteContent, SitePublication
from app.panel.content_registry import REGISTRY
from app.panel.services import content as content_service
from app.panel.services.snapshots import PublicFiles
from tests.panel.support import Browser, principal_of

URL = "/api/admin/content"
PUBLISH = f"{URL}/publications"


def site_file(tmp_path: Path) -> dict[str, Any]:
    document: dict[str, Any] = json.loads((tmp_path / "content" / "site.json").read_text(encoding="utf-8"))
    return document


def field_of(response, key: str) -> dict[str, Any]:
    field: dict[str, Any] = next(entry for entry in response.json()["fields"] if entry["key"] == key)
    return field


def save(browser: Browser, **values):
    return browser.put(URL, json={"values": values})


def audit(action: str) -> list[AuditEntry]:
    with SessionLocal() as db:
        return list(db.scalars(select(AuditEntry).where(AuditEntry.action == action).order_by(AuditEntry.id)))


# --- reading the places


def test_the_places_of_the_page_are_listed_with_their_defaults_and_nothing_to_publish(admin):
    body = admin.get(URL).json()

    assert body["has_unpublished_changes"] is False
    assert body["publication"] is None
    assert [entry["key"] for entry in body["fields"]] == [entry.key for entry in REGISTRY.fields]
    title = field_of(admin.get(URL), "hero.title_first")
    assert (title["default"], title["draft"], title["published"], title["changed"]) == (
        "Kiçik ideyalar.",
        None,
        None,
        False,
    )
    assert {"price", "capacity", "start_date"} <= set(body["placeholders"])
    assert {section["id"] for section in body["sections"]} == {entry.section for entry in REGISTRY.fields}


def test_a_list_place_tells_the_parts_of_its_items(admin):
    faq = field_of(admin.get(URL), "faq.items")

    assert faq["kind"] == "list"
    assert [(part["name"], part["kind"]) for part in faq["item"]] == [("q", "text"), ("a", "paragraph")]
    assert len(faq["default"]) == 9


# --- saving a draft


def test_a_saved_value_is_a_draft_not_yet_on_the_page(admin, tmp_path):
    response = save(admin, **{"hero.title_first": "  Yeni   başlıq  "})

    assert response.status_code == 200
    title = field_of(response, "hero.title_first")
    assert (title["draft"], title["published"], title["changed"]) == ("Yeni başlıq", None, True)
    assert response.json()["has_unpublished_changes"] is True
    assert not (tmp_path / "content" / "site.json").exists() or site_file(tmp_path)["content"] == {}
    (entry,) = audit("content_saved")
    assert entry.detail == {"keys": ["hero.title_first"]}


def test_saving_again_replaces_the_draft_and_null_puts_the_default_back(admin):
    save(admin, **{"hero.title_first": "One"})
    save(admin, **{"hero.title_first": "Two"})
    assert field_of(admin.get(URL), "hero.title_first")["draft"] == "Two"

    reset = save(admin, **{"hero.title_first": None})

    assert field_of(reset, "hero.title_first")["draft"] is None
    assert reset.json()["has_unpublished_changes"] is False
    with SessionLocal() as db:
        assert db.get(SiteContent, "hero.title_first") is None


def test_one_bad_value_saves_nothing_at_all(admin):
    response = save(admin, **{"hero.title_first": "Fine", "hero.primary_cta": "x" * 100})

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_content"
    assert (response.json()["key"], response.json()["rule"]) == ("hero.primary_cta", "too_long")
    assert field_of(admin.get(URL), "hero.title_first")["draft"] is None


def test_a_place_that_does_not_exist_is_refused_without_echoing_a_long_key(admin):
    response = save(admin, **{"not.a.place" + "x" * 200: "value"})

    assert response.status_code == 422
    assert response.json()["code"] == "unknown_content_key"
    assert len(response.json()["key"]) <= 80


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("founder.linkedin", "javascript:alert(1)"),
        ("brochure.file", "//evil.example/x.pdf"),
        ("contact.whatsapp", "+994509988707"),
        ("hero.subtitle", "Hello {prise}"),
        ("faq.items", [{"q": "Only a question"}]),
        ("demo_day.items", "not a list"),
        ("certificate.image", "../../etc/passwd"),
        ("hero.title_first", ["a"]),
    ],
)
def test_a_value_that_does_not_fit_its_place_is_refused(admin, key, value):
    assert save(admin, **{key: value}).status_code == 422


def test_a_whole_list_is_saved_as_one_value(admin):
    faq = [{"q": "Is it fun?", "a": "Yes, **very**."}, {"q": "Is it far?", "a": "No."}]

    response = save(admin, **{"faq.items": faq})

    assert field_of(response, "faq.items")["draft"] == faq


def test_the_draft_has_a_limit_on_how_many_places_one_request_may_change(admin):
    many = {f"hero.k{number}": "x" for number in range(201)}

    assert admin.put(URL, json={"values": many}).status_code == 422


# --- publishing


def test_publishing_writes_the_file_the_landing_page_reads(admin, tmp_path):
    save(admin, **{"hero.title_first": "Yeni başlıq", "contact.phone": "+994 55 111 22 33"})

    response = admin.post(PUBLISH)

    assert response.status_code == 201
    assert response.json()["version"] >= 1
    assert response.json()["published_by"] == "Test Staff"
    document = site_file(tmp_path)
    assert document["version"] == response.json()["version"]
    assert document["content"] == {"hero.title_first": "Yeni başlıq", "contact.phone": "+994 55 111 22 33"}
    body = admin.get(URL).json()
    assert body["has_unpublished_changes"] is False
    assert field_of(admin.get(URL), "hero.title_first")["published"] == "Yeni başlıq"
    assert body["publication"]["version"] == document["version"]
    (entry,) = audit("content_published")
    assert entry.detail == {"version": document["version"], "places": 2}


def test_a_change_after_publishing_waits_for_the_next_publication(admin, tmp_path):
    save(admin, **{"hero.title_first": "First"})
    admin.post(PUBLISH)

    save(admin, **{"hero.title_first": "Second"})

    assert site_file(tmp_path)["content"] == {"hero.title_first": "First"}
    assert field_of(admin.get(URL), "hero.title_first")["changed"] is True
    admin.post(PUBLISH)
    assert site_file(tmp_path)["content"] == {"hero.title_first": "Second"}


def test_every_publication_is_kept_as_history(admin):
    save(admin, **{"hero.title_first": "First"})
    admin.post(PUBLISH)
    save(admin, **{"hero.title_first": "Second"})
    admin.post(PUBLISH)

    with SessionLocal() as db:
        history = [
            publication.content
            for publication in db.scalars(select(SitePublication).order_by(SitePublication.id))
        ]
    assert history == [{"hero.title_first": "First"}, {"hero.title_first": "Second"}]


def test_putting_a_default_back_and_publishing_removes_it_from_the_file(admin, tmp_path):
    save(admin, **{"hero.title_first": "Changed"})
    admin.post(PUBLISH)

    save(admin, **{"hero.title_first": None})
    admin.post(PUBLISH)

    assert site_file(tmp_path)["content"] == {}


def test_publishing_with_nothing_changed_still_works_and_writes_an_empty_content(admin, tmp_path):
    assert admin.post(PUBLISH).status_code == 201
    assert site_file(tmp_path)["content"] == {}


def test_nothing_is_published_when_the_file_cannot_be_written(admin, tmp_path):
    save(admin, **{"hero.title_first": "Changed"})
    (tmp_path / "content").write_text("a file where the directory should be", encoding="utf-8")

    response = admin.post(PUBLISH)

    assert response.status_code == 503
    assert response.json()["code"] == "public_file_failed"
    with SessionLocal() as db:
        assert db.scalars(select(SitePublication)).all() == []
    assert audit("content_published") == []
    assert field_of(admin.get(URL), "hero.title_first")["draft"] == "Changed"  # the draft is still there


def test_a_publication_that_cannot_be_saved_leaves_the_page_as_the_database_has_it(
    make_staff, tmp_path, monkeypatch
):
    # The file is written first and the publication committed after; if the commit fails, the page must not
    # keep showing a version the database (and the audit log) never recorded.
    principal, files = principal_of(make_staff()), PublicFiles(tmp_path / "content")
    with SessionLocal() as db:
        db.add(SiteContent(key="hero.title_first", value="First"))
        db.commit()
        content_service.publish(db, principal, files)
        row = db.get(SiteContent, "hero.title_first")
        assert row is not None
        row.value = "Second"
        db.commit()

        def lose_the_connection() -> None:
            raise OperationalError("COMMIT", {}, Exception("the connection was lost"))

        monkeypatch.setattr(db, "commit", lose_the_connection)
        with pytest.raises(OperationalError):
            content_service.publish(db, principal, files)

    assert site_file(tmp_path)["content"] == {"hero.title_first": "First"}
    with SessionLocal() as db:
        assert len(db.scalars(select(SitePublication)).all()) == 1


def test_a_publication_that_cannot_be_saved_still_fails_loudly_when_the_page_cannot_be_put_back_either(
    make_staff, tmp_path, monkeypatch, caplog
):
    principal, files = principal_of(make_staff()), PublicFiles(tmp_path / "content")
    with SessionLocal() as db:
        db.add(SiteContent(key="hero.title_first", value="First"))
        db.commit()

        def lose_the_connection() -> None:
            raise OperationalError("COMMIT", {}, Exception("the connection was lost"))

        def disk_full(*_args, **_kwargs) -> None:
            raise OSError("disk full")

        monkeypatch.setattr(db, "commit", lose_the_connection)
        # The first write (the new page) works; putting the old one back does not.
        real_write = content_service.write_site_file
        monkeypatch.setattr(content_service, "write_site_file", disk_full)

        with caplog.at_level("ERROR", logger="app.panel.services.content"), pytest.raises(OperationalError):
            content_service.publish(db, principal, files)
        monkeypatch.setattr(content_service, "write_site_file", real_write)

    assert "could not be put back" in caplog.text
    with SessionLocal() as db:
        assert db.scalars(select(SitePublication)).all() == []  # nothing was recorded


def test_the_refresh_cannot_lay_the_old_page_over_a_new_one_before_the_publication_is_committed(
    make_staff, tmp_path
):
    principal, files = principal_of(make_staff()), PublicFiles(tmp_path / "content")
    with SessionLocal() as db:
        db.add(SiteContent(key="hero.title_first", value="First"))
        db.commit()
        content_service.publish(db, principal, files)
        row = db.get(SiteContent, "hero.title_first")
        assert row is not None
        row.value = "Second"
        db.commit()
    committing, may_commit, refreshed = threading.Event(), threading.Event(), threading.Event()

    def publish_slowly() -> None:
        with SessionLocal() as db:
            real_commit = db.commit

            def commit_when_allowed() -> None:
                committing.set()
                assert may_commit.wait(10)
                real_commit()

            db.commit = commit_when_allowed  # type: ignore[method-assign]
            content_service.publish(db, principal, files)

    def refresh() -> None:
        with SessionLocal() as db:
            content_service.refresh_site(db, files)
        refreshed.set()

    publisher, refresher = threading.Thread(target=publish_slowly), threading.Thread(target=refresh)
    publisher.start()
    assert committing.wait(10)  # the new file is written, the publication is not committed yet
    refresher.start()

    assert not refreshed.wait(0.5)  # the refresh waits for the lock instead of reading the old publication
    may_commit.set()
    publisher.join(10)
    refresher.join(10)
    assert site_file(tmp_path)["content"] == {"hero.title_first": "Second"}


def test_a_failed_write_leaves_the_published_page_byte_for_byte_as_it_was(admin, tmp_path, monkeypatch):
    save(admin, **{"hero.title_first": "First"})
    admin.post(PUBLISH)
    before = (tmp_path / "content" / "site.json").read_bytes()
    save(admin, **{"hero.title_first": "Second"})

    def refuse(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr("app.panel.services.snapshots.os.replace", refuse)

    response = admin.post(PUBLISH)

    assert (response.status_code, response.json()["code"]) == (503, "public_file_failed")
    assert (tmp_path / "content" / "site.json").read_bytes() == before
    assert [path.name for path in (tmp_path / "content").iterdir() if path.name.endswith(".tmp")] == []
    with SessionLocal() as db:
        assert len(db.scalars(select(SitePublication)).all()) == 1  # the failed one was not recorded


def test_the_site_file_has_no_trace_of_the_staff_or_the_draft(admin, tmp_path):
    save(admin, **{"hero.title_first": "Changed"})
    admin.post(PUBLISH)

    text = (tmp_path / "content" / "site.json").read_text(encoding="utf-8")

    assert admin.staff.email not in text
    assert str(admin.staff.id) not in text
    assert set(json.loads(text)) == {"version", "published_at", "content"}


# --- pictures in the content


def test_a_picture_that_was_never_uploaded_cannot_be_chosen(admin):
    response = save(admin, **{"founder.photo": str(uuid.uuid4())})

    assert response.status_code == 422
    assert response.json()["rule"] == "unknown_image"


def add_picture(tmp_path: Path, *, with_file: bool = True) -> uuid.UUID:
    asset_id = uuid.uuid4()
    with SessionLocal() as db:
        db.add(MediaAsset(id=asset_id, sha256=asset_id.hex * 2, width=10, height=10, byte_size=100))
        db.commit()
    if with_file:
        (tmp_path / "content" / "media").mkdir(parents=True, exist_ok=True)
        (tmp_path / "content" / "media" / f"{asset_id}.webp").write_bytes(b"RIFF....WEBP")
    return asset_id


def test_a_chosen_picture_reaches_the_page_as_the_address_of_its_file(admin, tmp_path):
    asset_id = add_picture(tmp_path)
    save(admin, **{"founder.photo": str(asset_id).upper()})

    admin.post(PUBLISH)

    assert site_file(tmp_path)["content"] == {"founder.photo": f"/media/{asset_id}.webp"}


def test_a_picture_whose_file_is_missing_cannot_be_published(admin, tmp_path):
    # A database restored without the content volume has the rows and not the files: the page would show a
    # broken picture while staff were told "published".
    asset_id = add_picture(tmp_path, with_file=False)
    save(admin, **{"founder.photo": str(asset_id)})

    response = admin.post(PUBLISH)

    assert (response.status_code, response.json()["code"], response.json()["rule"]) == (
        422,
        "invalid_content",
        "missing_image_file",
    )
    with SessionLocal() as db:
        assert db.scalars(select(SitePublication)).all() == []


def test_a_place_removed_from_the_registry_is_ignored_in_the_published_file(admin, tmp_path):
    with SessionLocal() as db:
        db.add(SiteContent(key="retired.place", value="old"))
        db.commit()

    admin.post(PUBLISH)

    assert site_file(tmp_path)["content"] == {}


# --- the roles


@pytest.mark.parametrize("role", [AdminRole.VIEWER, AdminRole.COORDINATOR])
def test_only_an_admin_edits_the_page(sign_in_as, role):
    browser = sign_in_as(role)

    assert browser.get(URL).status_code == 403
    assert save(browser, **{"hero.title_first": "x"}).status_code == 403
    assert browser.post(PUBLISH).status_code == 403
    assert browser.get("/api/admin/media").status_code == 403


# --- the refresh at start-up and the audit log


def test_the_site_file_is_written_at_start_up_from_the_last_publication(panel_app, admin, tmp_path):
    save(admin, **{"hero.title_first": "Published before the restart"})
    admin.post(PUBLISH)
    (tmp_path / "content" / "site.json").unlink()

    from fastapi.testclient import TestClient

    with TestClient(panel_app):  # starting the application runs the lifespan
        pass

    assert site_file(tmp_path)["content"] == {"hero.title_first": "Published before the restart"}
    assert (tmp_path / "content" / "courses.json").exists()


def test_the_audit_log_is_for_admins_and_lists_the_newest_first(sign_in_as):
    admin, coordinator = sign_in_as(AdminRole.ADMIN), sign_in_as(AdminRole.COORDINATOR)
    save(admin, **{"hero.title_first": "x"})

    page = admin.get("/api/admin/audit").json()

    assert page["total"] >= 3
    assert page["items"][0]["action"] == "content_saved"
    assert page["items"][0]["admin_email"] == admin.staff.email
    assert page["items"][0]["network"] == "203.0.113.0/24"
    assert coordinator.get("/api/admin/audit").status_code == 403


def test_the_audit_log_can_be_filtered_and_paginated(admin):
    save(admin, **{"hero.title_first": "x"})
    save(admin, **{"hero.title_first": "y"})

    only_saves = admin.get("/api/admin/audit?action=content_saved&limit=1").json()

    assert (only_saves["total"], len(only_saves["items"])) == (2, 1)
    assert admin.get("/api/admin/audit?limit=101").status_code == 422
    assert admin.get("/api/admin/audit?action=Robert'); DROP TABLE audit_log;--").status_code == 422
