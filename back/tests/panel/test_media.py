"""Pictures staff upload for the landing page (SEC-B-01): decoded, checked, encoded again."""

import io
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageOps
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import AdminRole, AuditEntry, MediaAsset
from app.panel.main import create_panel_app
from app.panel.services import media
from tests.conftest import make_settings
from tests.panel.support import Browser, FakeClock

URL = "/api/admin/media"


def picture(
    image_format: str = "PNG", size: tuple[int, int] = (40, 30), mode: str = "RGB", **options
) -> bytes:
    buffer = io.BytesIO()
    Image.new(mode, size, "red").save(buffer, format=image_format, **options)
    return buffer.getvalue()


def upload(browser: Browser, data: bytes, content_type: str = "image/png", **headers):
    return browser.post(
        URL, content=data, headers={**browser.headers, "Content-Type": content_type, **headers}
    )


def stored_file(tmp_path: Path, asset_id: str) -> bytes:
    return (tmp_path / "content" / "media" / f"{asset_id}.webp").read_bytes()


def stored_pictures() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(MediaAsset)) or 0


# --- a good picture


@pytest.mark.parametrize(
    ("image_format", "content_type"),
    [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")],
)
def test_a_png_a_jpeg_and_a_webp_are_accepted_and_stored_as_webp(admin, tmp_path, image_format, content_type):
    response = upload(admin, picture(image_format), content_type)

    assert response.status_code == 201
    body = response.json()
    assert body["url"] == f"/media/{body['id']}.webp"
    assert (body["width"], body["height"]) == (40, 30)
    saved = Image.open(io.BytesIO(stored_file(tmp_path, body["id"])))
    assert (saved.format, saved.size) == ("WEBP", (40, 30))
    assert body["byte_size"] == len(stored_file(tmp_path, body["id"]))


def test_transparency_is_kept(admin, tmp_path):
    see_through = io.BytesIO()
    Image.new("RGBA", (40, 30), (255, 0, 0, 128)).save(see_through, format="PNG")

    body = upload(admin, see_through.getvalue()).json()

    assert "A" in Image.open(io.BytesIO(stored_file(tmp_path, body["id"]))).getbands()


def test_a_photo_is_turned_the_right_way_up_and_loses_its_metadata(admin, tmp_path):
    exif = Image.Exif()
    exif[0x0112] = 6  # "rotate by 90 degrees to show"
    exif[0x010F] = "SecretCamera"
    exif[0x013B] = "Someone Private"
    data = picture("JPEG", size=(40, 20), exif=exif)
    assert b"SecretCamera" in data  # the test photo really carries it

    body = upload(admin, data, "image/jpeg").json()

    kept = stored_file(tmp_path, body["id"])
    assert (body["width"], body["height"]) == (20, 40)
    assert b"SecretCamera" not in kept
    assert b"Someone Private" not in kept
    assert b"Exif" not in kept
    assert len(Image.open(io.BytesIO(kept)).getexif()) == 0


def test_a_very_large_picture_is_shrunk(admin):
    body = upload(admin, picture("PNG", size=(5000, 100))).json()

    assert (body["width"], body["height"]) == (2400, 48)


def test_bytes_added_after_the_picture_are_not_kept(admin, tmp_path):
    hidden = b"<script>alert('x')</script><?php system($_GET['c']); ?>"

    body = upload(admin, picture("PNG") + hidden).json()

    assert hidden not in stored_file(tmp_path, body["id"])
    assert b"<script>" not in stored_file(tmp_path, body["id"])


def test_the_file_is_named_by_the_new_id_not_by_anything_the_sender_wrote(admin, tmp_path):
    body = upload(
        admin, picture("PNG"), **{"Content-Disposition": 'attachment; filename="../../etc/cron.d/evil.webp"'}
    ).json()

    saved = sorted(path.name for path in (tmp_path / "content" / "media").iterdir())
    assert saved == [f"{body['id']}.webp"]
    assert not (tmp_path / "etc").exists()


def test_the_same_picture_twice_is_one_picture(admin, tmp_path):
    first = upload(admin, picture("PNG")).json()
    second = upload(admin, picture("PNG")).json()

    assert first["id"] == second["id"]
    assert stored_pictures() == 1
    assert len(list((tmp_path / "content" / "media").iterdir())) == 1


def test_an_upload_is_audited_with_its_size_and_nothing_the_sender_wrote(admin):
    body = upload(admin, picture("PNG")).json()

    with SessionLocal() as db:
        (entry,) = db.scalars(select(AuditEntry).where(AuditEntry.action == "media_uploaded")).all()
    assert entry.entity_id == body["id"]
    assert entry.detail == {"bytes": body["byte_size"], "width": 40, "height": 30}


def test_the_exif_the_icc_profile_and_the_xmp_of_a_photo_are_all_dropped(admin, tmp_path):
    xmp = b"http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta>SecretXmpOwner</x:xmpmeta>"
    data = picture("JPEG", size=(40, 20), icc_profile=b"SecretIccProfile" * 20, xmp=xmp)
    assert b"SecretIccProfile" in data  # the test photo really carries them
    assert b"SecretXmpOwner" in data

    body = upload(admin, data, "image/jpeg").json()

    kept = stored_file(tmp_path, body["id"])
    assert b"SecretIccProfile" not in kept
    assert b"SecretXmpOwner" not in kept
    assert b"ICCP" not in kept  # not even the (empty) chunks of a WebP file
    assert b"XMP " not in kept


def test_the_same_picture_again_puts_back_a_file_that_is_gone(admin, tmp_path):
    # A database restored without the content volume has the picture's row and not its file.
    first = upload(admin, picture("PNG")).json()
    (tmp_path / "content" / "media" / f"{first['id']}.webp").unlink()

    second = upload(admin, picture("PNG")).json()

    assert second["id"] == first["id"]
    assert Image.open(io.BytesIO(stored_file(tmp_path, first["id"]))).format == "WEBP"


def test_putting_back_a_file_that_is_gone_fails_cleanly_when_it_cannot_be_written(
    admin, tmp_path, monkeypatch
):
    first = upload(admin, picture("PNG")).json()
    (tmp_path / "content" / "media" / f"{first['id']}.webp").unlink()

    def refuse(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr("app.panel.services.snapshots.os.replace", refuse)

    response = upload(admin, picture("PNG"))

    assert (response.status_code, response.json()["code"]) == (503, "public_file_failed")
    assert stored_pictures() == 1  # the picture is still known; only its file is missing


def test_a_failed_write_leaves_nothing_behind_in_the_volume(admin, tmp_path, monkeypatch):
    def refuse(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr("app.panel.services.snapshots.os.replace", refuse)

    response = upload(admin, picture("PNG"))

    assert (response.status_code, response.json()["code"]) == (503, "public_file_failed")
    assert [path.name for path in (tmp_path / "content" / "media").iterdir()] == []  # not even a .tmp file
    assert stored_pictures() == 0


def test_a_picture_is_decoded_while_the_one_decode_at_a_time_lock_is_held(admin, monkeypatch):
    seen = []
    real_transpose = ImageOps.exif_transpose

    def spy(image):
        seen.append(media._one_decode_at_a_time.locked())
        return real_transpose(image)

    monkeypatch.setattr(ImageOps, "exif_transpose", spy)

    assert upload(admin, picture("PNG")).status_code == 201
    assert seen == [True]
    assert not media._one_decode_at_a_time.locked()  # and it is let go again


def test_the_pictures_are_listed_newest_first(admin):
    first = upload(admin, picture("PNG", size=(10, 10))).json()
    second = upload(admin, picture("PNG", size=(11, 11))).json()

    page = admin.get(URL).json()

    assert page["total"] == 2
    assert [item["id"] for item in page["items"]] == [second["id"], first["id"]]
    assert page["items"][0]["url"] == f"/media/{second['id']}.webp"
    assert admin.get(f"{URL}?limit=101").status_code == 422


# --- what is refused


def gif() -> bytes:
    return picture("GIF")


def animated(image_format: str) -> bytes:
    frames = [Image.new("RGB", (10, 10), colour) for colour in ("red", "blue")]
    buffer = io.BytesIO()
    frames[0].save(buffer, format=image_format, save_all=True, append_images=frames[1:], duration=100)
    return buffer.getvalue()


@pytest.mark.parametrize(
    "data",
    [
        pytest.param(b"", id="empty"),
        pytest.param(b"not a picture at all", id="text"),
        pytest.param(b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", id="svg"),
        pytest.param(b"<html><script>alert(1)</script></html>", id="html"),
        pytest.param(gif(), id="gif"),
        pytest.param(picture("BMP"), id="bmp"),
        pytest.param(picture("PNG")[:40], id="truncated png"),
        pytest.param(picture("PNG")[: len(picture("PNG")) // 2], id="png cut in half"),
        pytest.param(animated("WEBP"), id="animated webp"),
        pytest.param(animated("PNG"), id="animated png"),
        pytest.param(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, id="png signature and garbage"),
        pytest.param(b"%PDF-1.7 " + b"\x00" * 100, id="pdf"),
    ],
)
def test_anything_that_is_not_a_plain_picture_is_refused(admin, data):
    response = upload(admin, data, "image/png")

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_image"
    assert stored_pictures() == 0


@pytest.mark.parametrize(
    "content_type", ["text/html", "image/svg+xml", "image/gif", "application/octet-stream", ""]
)
def test_only_png_jpeg_and_webp_are_accepted_as_a_content_type(admin, content_type):
    response = upload(admin, picture("PNG"), content_type)

    assert (response.status_code, response.json().get("reason")) == (422, "unsupported_type")


def test_a_picture_is_known_by_what_it_is_not_by_what_the_sender_calls_it(admin):
    # A JPEG sent as "image/png" is still a picture; an HTML page sent as "image/png" is still not.
    assert upload(admin, picture("JPEG"), "image/png").status_code == 201
    assert upload(admin, b"<html></html>", "image/png").status_code == 422


def test_a_picture_with_too_many_pixels_is_refused_before_it_is_decoded(admin, monkeypatch):
    monkeypatch.setattr(media, "MAX_PIXELS", 1000)

    response = upload(admin, picture("PNG", size=(100, 100)))

    assert (response.status_code, response.json()["reason"]) == (422, "too_many_pixels")


def test_a_decompression_bomb_is_refused(admin):
    # 30000 x 1000 white pixels compress to a few kilobytes and would need 90 MB once decoded.
    bomb = picture("PNG", size=(30000, 1000), mode="1")
    assert len(bomb) < 100_000

    response = upload(admin, bomb)

    assert (response.status_code, response.json()["reason"]) == (422, "too_many_pixels")


def test_the_number_of_pictures_is_limited(admin, monkeypatch):
    monkeypatch.setattr(media, "MAX_PICTURES", 2)
    upload(admin, picture("PNG", size=(10, 10)))
    upload(admin, picture("PNG", size=(11, 11)))

    refused = upload(admin, picture("PNG", size=(12, 12)))

    assert (refused.status_code, refused.json()["reason"]) == (422, "too_many_pictures")
    assert upload(admin, picture("PNG", size=(10, 10))).status_code == 201  # one it already has is no new one


def test_a_body_bigger_than_the_limit_is_refused_before_it_is_read(
    panel_settings, clock: FakeClock, make_staff
):
    settings = make_settings(**{**panel_settings.model_dump(), "panel_max_image_bytes": 2000})
    app = create_panel_app(settings, clock)
    browser = Browser(app, make_staff(AdminRole.ADMIN), clock)

    small = upload(browser, picture("PNG", size=(10, 10)))
    big = upload(browser, b"\x89PNG" + b"0" * 5000)

    assert small.status_code == 201
    assert big.status_code == 413


def test_other_endpoints_keep_the_small_body_limit(panel_settings, clock: FakeClock, make_staff):
    settings = make_settings(**{**panel_settings.model_dump(), "panel_max_body_bytes": 1000})
    browser = Browser(create_panel_app(settings, clock), make_staff(AdminRole.ADMIN), clock)

    response = browser.put("/api/admin/content", json={"values": {"hero.subtitle": "x" * 5000}})

    assert response.status_code == 413


def test_an_upload_needs_the_csrf_token_like_any_other_change(admin):
    response = admin.client.post(URL, content=picture("PNG"), headers={"Content-Type": "image/png"})

    assert response.status_code == 403


def test_a_coordinator_cannot_upload(sign_in_as):
    response = upload(sign_in_as(AdminRole.COORDINATOR), picture("PNG"))

    assert response.status_code == 403


def test_without_signing_in_nothing_can_be_uploaded(panel: TestClient):
    response = panel.post(URL, content=picture("PNG"), headers={"Content-Type": "image/png"})

    assert response.status_code == 401


# --- taking a picture off the site (a parent may withdraw consent for a photo of a child)

CONTENT = "/api/admin/content"


def audit_entries(action: str) -> list[AuditEntry]:
    with SessionLocal() as db:
        return list(db.scalars(select(AuditEntry).where(AuditEntry.action == action)))


def test_a_picture_nobody_uses_is_removed_with_its_file_and_the_removal_is_audited(admin, tmp_path):
    body = upload(admin, picture("PNG")).json()

    response = admin.delete(f"{URL}/{body['id']}")

    assert response.status_code == 204
    assert stored_pictures() == 0
    assert not (tmp_path / "content" / "media" / f"{body['id']}.webp").exists()
    (entry,) = audit_entries("media_deleted")
    assert (entry.entity_type, entry.entity_id) == ("media", body["id"])
    assert entry.detail == {"bytes": body["byte_size"]}
    assert admin.get(URL).json()["items"] == []


def test_a_picture_the_draft_uses_is_not_removed_until_the_draft_lets_go_of_it(admin, tmp_path):
    body = upload(admin, picture("PNG")).json()
    admin.put(CONTENT, json={"values": {"founder.photo": body["id"]}})

    refused = admin.delete(f"{URL}/{body['id']}")

    assert (refused.status_code, refused.json()["code"]) == (409, "media_in_use")
    assert stored_pictures() == 1
    assert (tmp_path / "content" / "media" / f"{body['id']}.webp").exists()
    admin.put(CONTENT, json={"values": {"founder.photo": None}})
    assert admin.delete(f"{URL}/{body['id']}").status_code == 204


def test_a_picture_the_live_page_shows_is_removed_only_after_a_new_publication_replaces_it(admin, tmp_path):
    body = upload(admin, picture("PNG")).json()
    admin.put(CONTENT, json={"values": {"founder.photo": body["id"]}})
    admin.post(f"{CONTENT}/publications")
    admin.put(CONTENT, json={"values": {"founder.photo": None}})  # the draft let go of it, the page did not

    assert admin.delete(f"{URL}/{body['id']}").status_code == 409

    admin.post(f"{CONTENT}/publications")
    assert admin.delete(f"{URL}/{body['id']}").status_code == 204
    assert stored_pictures() == 0


def test_removing_an_unknown_picture_is_not_found(admin):
    response = admin.delete(f"{URL}/{uuid.uuid4()}")

    assert (response.status_code, response.json()["code"]) == (404, "media_not_found")
    assert admin.delete(f"{URL}/not-an-id").status_code == 422


def test_a_picture_whose_file_is_already_gone_can_still_be_removed(admin, tmp_path):
    body = upload(admin, picture("PNG")).json()
    (tmp_path / "content" / "media" / f"{body['id']}.webp").unlink()

    assert admin.delete(f"{URL}/{body['id']}").status_code == 204
    assert stored_pictures() == 0


def test_a_picture_whose_file_cannot_be_removed_stays_listed(admin, tmp_path, monkeypatch):
    body = upload(admin, picture("PNG")).json()

    def refuse(self, missing_ok=False):
        raise PermissionError("not allowed")

    monkeypatch.setattr(Path, "unlink", refuse)

    response = admin.delete(f"{URL}/{body['id']}")

    assert (response.status_code, response.json()["code"]) == (503, "public_file_failed")
    assert stored_pictures() == 1
    assert audit_entries("media_deleted") == []


def test_only_an_admin_removes_a_picture_and_not_without_the_csrf_token(sign_in_as, admin):
    body = upload(admin, picture("PNG")).json()

    for role in (AdminRole.VIEWER, AdminRole.COORDINATOR):
        assert sign_in_as(role).delete(f"{URL}/{body['id']}").status_code == 403
    assert admin.client.delete(f"{URL}/{body['id']}").status_code == 403  # no token, no Origin
    assert stored_pictures() == 1


def test_a_picture_that_cannot_be_written_is_not_listed(admin, tmp_path):
    (tmp_path / "content").write_text("a file where the directory should be", encoding="utf-8")

    response = upload(admin, picture("PNG"))

    assert (response.status_code, response.json()["code"]) == (503, "public_file_failed")
    assert stored_pictures() == 0
