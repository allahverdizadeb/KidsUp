"""End-to-end check of the landing page <-> admin panel integration against a RUNNING stack.

It talks to the public site and to the admin origin over HTTP and looks into the database through the
stack's own containers. It creates test staff accounts, test applications ("TEST ..." names, made up) and
test courses, so it must run against a THROW-AWAY stack, never the real one: `scripts/verify-stack.ps1`
starts one, runs this file and removes it again. The real project's name (`kidsup`) is refused.

    python scripts/e2e_check.py --project kidsup_check \
        --public http://127.0.0.1:18080 --admin http://127.0.0.1:18081

Needs `httpx`, `pyotp` and `pillow` (the backend's virtual environment has them). Prints PASS/FAIL lines
only: no password, no code, no secret and no personal data. Exits 1 if any check fails.
"""

import argparse
import io
import json
import secrets
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import pyotp
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NOTICE = "2026-10-19"  # a published version of the privacy notice (back/app/schemas/application.py)
REAL_PROJECT = "kidsup"
results: list[tuple[str, bool]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + ("" if ok or not detail else f"  -> {detail}"), flush=True)


class Stack:
    """Where the stack is, and the two ways into its containers."""

    def __init__(self, project: str, public: str, admin: str) -> None:
        self.project, self.public, self.admin = project, public.rstrip("/"), admin.rstrip("/")

    def compose(self, *arguments: str, stdin: str | None = None) -> str:
        done = subprocess.run(  # noqa: S603 (fixed program; the arguments are ours)
            ["docker", "compose", "-p", self.project, *arguments],  # noqa: S607
            input=stdin,
            capture_output=True,
            text=True,
            cwd=ROOT,
            check=False,
        )
        if done.returncode != 0:
            raise RuntimeError(done.stderr[-400:])
        return done.stdout.strip()

    def psql(self, sql: str) -> str:
        return self.compose("exec", "-T", "db", "psql", "-U", "kidsup", "-d", "kidsup", "-At", "-c", sql)

    def courses(self) -> list[dict[str, Any]]:
        answer: list[dict[str, Any]] = httpx.get(f"{self.public}/content/courses.json", timeout=30).json()[
            "courses"
        ]
        return answer


CREATE_STAFF = """
import json, sys
from app.config import settings
from app.db import SessionLocal
from app.models import AdminRole
from app.panel.services import admins, auth
from app.panel.services.secret_box import SecretBox
data = json.load(sys.stdin)
new = auth.NewAdmin(email=data["email"], display_name=data["name"], role=AdminRole(data["role"]),
                    password=data["password"], totp_secret=data["secret"])
with SessionLocal() as db:
    auth.create_admin(db, new, SecretBox(settings.panel_secret_key), admins.OPERATOR)
"""


class Staff:
    """A member of staff made for this run (by the same code as the operator command), signed in by HTTP."""

    def __init__(self, stack: Stack, role: str) -> None:
        self.stack, self.role = stack, role
        self.email = f"check-{role}-{secrets.token_hex(3)}@example.test"
        self.password = secrets.token_urlsafe(18)
        self.secret = pyotp.random_base32()
        self.last_step = 0
        self.cookie = ""
        self.csrf = ""
        payload = {
            "email": self.email,
            "name": f"Check {role}",
            "role": role,
            "password": self.password,
            "secret": self.secret,
        }
        stack.compose("exec", "-T", "panel", "python", "-c", CREATE_STAFF, stdin=json.dumps(payload))

    def code(self) -> str:
        """The one-time code for a 30-second step later than the last one used (a code works once)."""
        while int(time.time() // 30) <= self.last_step:
            time.sleep(1)
        self.last_step = int(time.time() // 30)
        return pyotp.TOTP(self.secret).at(self.last_step * 30)

    def sign_in(self, *, password: str | None = None) -> httpx.Response:
        body = {"email": self.email, "password": password or self.password, "code": self.code()}
        response = httpx.post(
            f"{self.stack.admin}/api/admin/sessions", json=body, headers={"Origin": self.stack.admin}
        )
        if response.status_code == 201:
            raw = response.headers.get("set-cookie", "")
            self.cookie = raw.split(";")[0].split("=", 1)[1] if "=" in raw else ""
            self.csrf = response.json()["csrf_token"]
        return response

    def call(self, method: str, path: str, **options: Any) -> httpx.Response:
        # The cookie is `Secure`, so a plain-http client would not send it back by itself: send it by hand.
        headers = {"Cookie": f"__Secure-kidsup_admin={self.cookie}", **options.pop("headers", {})}
        if method not in ("GET", "HEAD"):
            headers.update({"X-CSRF-Token": self.csrf, "Origin": self.stack.admin})
        return httpx.request(method, f"{self.stack.admin}{path}", headers=headers, timeout=30, **options)

    def find(self, text: str) -> dict[str, Any] | None:
        page = self.call("POST", "/api/admin/applications/search", json={"search": text, "limit": 50}).json()
        return page["items"][0] if page.get("items") else None


def apply(
    stack: Stack, parent: str, phone: str, children: list[tuple[str, str]], course_id: str | None = None
) -> httpx.Response:
    body: dict[str, Any] = {
        "parent_name": parent,
        "phone": phone,
        "children": [{"name": name, "birth_date": born} for name, born in children],
        "languages": ["Azərbaycan"],
        "consent": True,
        "privacy_notice_version": NOTICE,
    }
    if course_id:
        body["course_id"] = course_id
    for _ in range(3):
        response = httpx.post(f"{stack.public}/api/applications", json=body, timeout=30)
        if response.status_code != 429:
            return response
        time.sleep(62)  # the API allows 10 a minute per client
    return response


def picture() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (600, 400), (255, 0, 131)).save(out, "PNG")
    return out.getvalue()


def sign_in_and_sessions(stack: Stack, admin: Staff) -> None:
    wrong = admin.sign_in(password="definitely not the password")  # noqa: S106 (a wrong one, on purpose)
    check("sign-in with a wrong password is refused (401)", wrong.status_code == 401, str(wrong.status_code))
    admin.last_step = 0
    ok = admin.sign_in()
    check("sign-in with password and one-time code works (201)", ok.status_code == 201, str(ok.status_code))
    flags = ok.headers.get("set-cookie", "").lower()
    check(
        "the session cookie is HttpOnly, Secure, SameSite=Strict, path /api/admin",
        all(flag in flags for flag in ("httponly", "secure", "samesite=strict", "path=/api/admin")),
    )
    check(
        "the session says who is signed in",
        admin.call("GET", "/api/admin/sessions/current").status_code == 200,
    )
    anonymous = httpx.get(f"{stack.admin}/api/admin/applications/pulse")
    check("no session, no data (401)", anonymous.status_code == 401, str(anonymous.status_code))
    replay_code = pyotp.TOTP(admin.secret).at(admin.last_step * 30)
    replay = httpx.post(
        f"{stack.admin}/api/admin/sessions",
        json={"email": admin.email, "password": admin.password, "code": replay_code},
        headers={"Origin": stack.admin},
    )
    check("a one-time code cannot be used twice", replay.status_code == 401, str(replay.status_code))
    without_token = httpx.post(
        f"{stack.admin}/api/admin/courses",
        json={},
        headers={"Cookie": f"__Secure-kidsup_admin={admin.cookie}", "Origin": stack.admin},
    )
    check("a change without the CSRF token is refused", without_token.status_code in (401, 403))
    foreign = httpx.post(
        f"{stack.admin}/api/admin/courses",
        json={},
        headers={
            "Cookie": f"__Secure-kidsup_admin={admin.cookie}",
            "X-CSRF-Token": admin.csrf,
            "Origin": "https://evil.example",
        },
    )
    check(
        "a change from another origin is refused", foreign.status_code in (401, 403), str(foreign.status_code)
    )


def registration_and_statuses(stack: Stack, admin: Staff) -> str:
    courses = stack.courses()
    check("the landing page is offered exactly one open course", len(courses) == 1, str(len(courses)))
    first_course = courses[0]["id"] if courses else ""
    refused = httpx.post(
        f"{stack.public}/api/applications",
        json={
            "parent_name": "TEST",
            "phone": "050 000 00 01",
            "children": [],
            "languages": [],
            "consent": False,
            "privacy_notice_version": NOTICE,
        },
    )
    check("an invalid application is refused (422)", refused.status_code == 422, str(refused.status_code))
    made = apply(stack, "TEST Valideyn Bir", "+994 50 000 00 01", [("TEST Usaq Bir", "2016-05-20")])
    check(
        "a registration from the landing page is stored (201)", made.status_code == 201, str(made.status_code)
    )
    found = admin.find("TEST Valideyn Bir")
    check("it appears in the panel as a new application", found is not None and found["status"] == "new")
    if found is None:
        return first_course
    detail = admin.call("GET", f"/api/admin/applications/{found['id']}").json()
    check(
        "the detail keeps the consent time and the privacy notice version",
        detail["privacy_notice_version"] == NOTICE and detail["consent_given_at"] is not None,
    )
    seats_before = stack.courses()[0]["seats_left"]
    check("a new application takes no place yet", stack.courses()[0]["seats_left"] == seats_before)
    for status in ("contacted", "declined", "contacted"):
        changed = admin.call("PATCH", f"/api/admin/applications/{found['id']}", json={"status": status})
        stored = stack.psql(f"select status from applications where id = '{found['id']}'")  # noqa: S608
        check(
            f"status -> {status} is saved in the database",
            changed.status_code == 200 and stored == status,
            stored,
        )
    note = admin.call("POST", f"/api/admin/applications/{found['id']}/notes", json={"body": "TEST note"})
    check("an internal note is saved (201)", note.status_code == 201, str(note.status_code))
    approved = admin.call("PATCH", f"/api/admin/applications/{found['id']}", json={"status": "approved"})
    check("approving works while places are free", approved.status_code == 200, str(approved.status_code))
    check(
        "an approved child takes a place on the landing page",
        stack.courses()[0]["seats_left"] == seats_before - 1,
    )
    totals = admin.call("GET", "/api/admin/dashboard").json()["totals"]
    check(
        "the dashboard is computed from real rows",
        totals["applications"] >= 1 and totals["approved_children"] >= 1,
        json.dumps(totals),
    )
    audit = admin.call("GET", "/api/admin/audit?action=application_status_changed").json()
    check("the status changes are in the audit log", audit["total"] >= 4, str(audit["total"]))
    check(
        "the audit log holds no names or numbers",
        "TEST" not in json.dumps(audit) and "+994" not in json.dumps(audit),
    )
    return first_course


def courses_and_limits(stack: Stack, admin: Staff, first_course: str) -> str:
    created = admin.call(
        "POST",
        "/api/admin/courses",
        json={
            "title": "TEST Yaz 2027",
            "start_date": "2027-03-06",
            "schedule": "bazar, 10:00-13:30",
            "location": "Baki, TEST",
            "age_min": 9,
            "age_max": 12,
            "price_minor": 70000,
            "second_child_price_minor": 55000,
            "capacity": 2,
            "registration_open": True,
        },
    )
    check("a course is created (201)", created.status_code == 201, str(created.status_code))
    spring: str = created.json()["id"]
    listed = stack.courses()
    check(
        "the landing page offers both open courses with their own figures",
        {c["id"] for c in listed} == {first_course, spring}
        and any(c["price_minor"] == 70000 and c["capacity"] == 2 and c["seats_left"] == 2 for c in listed),
    )
    ambiguous = apply(stack, "TEST Valideyn Ambiguous", "+994 50 000 00 09", [("TEST Usaq", "2016-05-20")])
    check("with several open courses and none chosen the API refuses (409)", ambiguous.status_code == 409)

    families = []
    for number in (2, 3, 4):
        reply = apply(
            stack,
            f"TEST Valideyn {number}",
            f"+994 50 000 00 0{number}",
            [(f"TEST Usaq {number}", "2016-05-20")],
            spring,
        )
        check(
            f"application {number} for the small course is stored",
            reply.status_code == 201,
            str(reply.status_code),
        )
        families.append(admin.find(f"TEST Valideyn {number}"))
    a, b, c = (family or {"id": ""} for family in families)
    one = admin.call("PATCH", f"/api/admin/applications/{a['id']}", json={"status": "approved"})
    two = admin.call("PATCH", f"/api/admin/applications/{b['id']}", json={"status": "approved"})
    over = admin.call("PATCH", f"/api/admin/applications/{c['id']}", json={"status": "approved"})
    check("two approvals fit the capacity of 2", one.status_code == 200 and two.status_code == 200)
    check(
        "the third approval is refused (409 not_enough_seats): the limit holds",
        over.status_code == 409 and over.json().get("code") == "not_enough_seats",
        f"{over.status_code} {over.text[:100]}",
    )
    check(
        "the refused application stays as it was",
        stack.psql(f"select status from applications where id = '{c['id']}'") == "new",  # noqa: S608
    )
    full = next((x for x in stack.courses() if x["id"] == spring), None)
    check(
        "the full course says so on the landing page (0 left, closed to applications)",
        full is not None and full["seats_left"] == 0 and full["accepting_applications"] is False,
    )
    late = apply(stack, "TEST Valideyn Late", "+994 50 000 00 08", [("TEST Usaq", "2016-05-20")], spring)
    check("a full course takes no more applications (409)", late.status_code == 409, str(late.status_code))
    shrink = admin.call("PATCH", f"/api/admin/courses/{spring}", json={"capacity": 1})
    check(
        "capacity cannot go below the approved children (409)",
        shrink.status_code == 409 and shrink.json().get("code") == "capacity_below_approved",
    )
    admin.call("PATCH", f"/api/admin/applications/{a['id']}", json={"status": "declined"})
    check(
        "declining frees the place on the landing page",
        next(x for x in stack.courses() if x["id"] == spring)["seats_left"] == 1,
    )
    check(
        "and the waiting application can then be approved",
        admin.call("PATCH", f"/api/admin/applications/{c['id']}", json={"status": "approved"}).status_code
        == 200,
    )
    admin.call("PATCH", f"/api/admin/courses/{spring}", json={"registration_open": False})
    check(
        "a course closed for registration leaves the landing page",
        spring not in {x["id"] for x in stack.courses()},
    )
    admin.call("PATCH", f"/api/admin/courses/{spring}", json={"registration_open": True})
    check("and opened again it is back", spring in {x["id"] for x in stack.courses()})

    seats = next(x for x in stack.courses() if x["id"] == first_course)["seats_left"]
    pair = apply(
        stack,
        "TEST Valideyn Cut",
        "+994 50 000 00 07",
        [("TEST Usaq A", "2016-05-20"), ("TEST Usaq B", "2015-01-01")],
        first_course,
    )
    row = admin.find("TEST Valideyn Cut")
    check("an application with two children is stored", pair.status_code == 201 and row is not None)
    if row:
        admin.call("PATCH", f"/api/admin/applications/{row['id']}", json={"status": "approved"})
        left = next(x for x in stack.courses() if x["id"] == first_course)["seats_left"]
        check("approving it takes two places", left == seats - 2, f"{seats} -> {left}")
    export = admin.call("POST", "/api/admin/applications/export", json={})
    check(
        "the export is a CSV download",
        export.status_code == 200
        and "text/csv" in export.headers.get("content-type", "")
        and "attachment" in export.headers.get("content-disposition", ""),
    )
    return spring


def roles(stack: Stack, found_id: str) -> None:
    viewer, coordinator = Staff(stack, "viewer"), Staff(stack, "coordinator")
    viewer.sign_in()
    coordinator.sign_in()
    path = f"/api/admin/applications/{found_id}"
    check("a viewer can read", viewer.call("GET", "/api/admin/applications/pulse").status_code == 200)
    check(
        "a viewer cannot change a status (403)",
        viewer.call("PATCH", path, json={"status": "new"}).status_code == 403,
    )
    check(
        "a viewer cannot export (403)",
        viewer.call("POST", "/api/admin/applications/export", json={}).status_code == 403,
    )
    check(
        "a viewer cannot read the audit log (403)", viewer.call("GET", "/api/admin/audit").status_code == 403
    )
    check(
        "a coordinator can change a status",
        coordinator.call("PATCH", path, json={"status": "approved"}).status_code == 200,
    )
    check(
        "a coordinator cannot export (403)",
        coordinator.call("POST", "/api/admin/applications/export", json={}).status_code == 403,
    )
    check(
        "a coordinator cannot edit the site (403)",
        coordinator.call("GET", "/api/admin/content").status_code == 403,
    )
    check(
        "a coordinator cannot create a course",
        coordinator.call("POST", "/api/admin/courses", json={}).status_code in (403, 422),
    )


def landing_page_content(stack: Stack, admin: Staff) -> None:
    before = httpx.get(f"{stack.public}/content/site.json").json()
    saved = admin.call(
        "PUT", "/api/admin/content", json={"values": {"hero.title_first": "TEST Yeni basliq."}}
    )
    check("a text is saved as a draft", saved.status_code == 200, str(saved.status_code))
    check(
        "a draft is not on the site until it is published",
        httpx.get(f"{stack.public}/content/site.json").json()["content"] == before["content"],
    )
    evil = admin.call(
        "PUT", "/api/admin/content", json={"values": {"founder.linkedin": "javascript:alert(1)"}}
    )
    check("a script link is refused (422)", evil.status_code == 422, str(evil.status_code))
    unknown = admin.call("PUT", "/api/admin/content", json={"values": {"no.such.place": "x"}})
    check("an unknown place is refused (422)", unknown.status_code == 422, str(unknown.status_code))
    uploaded = admin.call(
        "POST", "/api/admin/media", content=picture(), headers={"Content-Type": "image/png"}
    )
    check(
        "a picture is uploaded (201)",
        uploaded.status_code == 201,
        f"{uploaded.status_code} {uploaded.text[:80]}",
    )
    media_id = uploaded.json()["id"] if uploaded.status_code == 201 else ""
    fake = admin.call(
        "POST", "/api/admin/media", content=b"<?php echo 1; ?>", headers={"Content-Type": "image/png"}
    )
    check("a file that is not a picture is refused (422)", fake.status_code == 422, str(fake.status_code))
    admin.call(
        "PUT",
        "/api/admin/content",
        json={"values": {"founder.photo": media_id, "founder.photo_alt": "TEST foto"}},
    )
    published = admin.call("POST", "/api/admin/content/publications")
    check("publishing works (201)", published.status_code == 201, str(published.status_code))
    live = httpx.get(f"{stack.public}/content/site.json").json()["content"]
    check(
        "the published text and picture are in the file the landing page reads",
        live.get("hero.title_first") == "TEST Yeni basliq."
        and live.get("founder.photo") == f"/media/{media_id}.webp",
    )
    image = httpx.get(f"{stack.public}/media/{media_id}.webp")
    check(
        "the picture is served as WebP and cached for a day only (never 'immutable')",
        image.status_code == 200
        and image.headers.get("content-type") == "image/webp"
        and "max-age=86400" in image.headers.get("cache-control", "")
        and "immutable" not in image.headers.get("cache-control", ""),
    )
    check("it is real WebP", image.content[:4] == b"RIFF" and image.content[8:12] == b"WEBP")
    in_use = admin.call("DELETE", f"/api/admin/media/{media_id}")
    check(
        "a picture the live page shows cannot be removed (409)",
        in_use.status_code == 409,
        str(in_use.status_code),
    )
    admin.call("PUT", "/api/admin/content", json={"values": {"founder.photo": None}})
    admin.call("POST", "/api/admin/content/publications")
    removed = admin.call("DELETE", f"/api/admin/media/{media_id}")
    check("once the page no longer shows it, the picture is removed (204)", removed.status_code == 204)
    check(
        "and its file is gone from the landing page's server",
        httpx.get(f"{stack.public}/media/{media_id}.webp").status_code == 404,
    )


def signing_out(admin: Staff) -> None:
    check("signing out works (204)", admin.call("DELETE", "/api/admin/sessions/current").status_code == 204)
    check(
        "the old cookie no longer works (401)",
        admin.call("GET", "/api/admin/sessions/current").status_code == 401,
    )


PYTHON_CONTAINERS = ("back", "panel", "retention")


def reaches(stack: Stack, service: str, host: str, port: int) -> bool:
    """Whether a TCP connection from inside a container to host:port can be made at all."""
    if service in PYTHON_CONTAINERS:
        command = [
            "python",
            "-c",
            f"import socket, sys\ntry:\n    socket.create_connection(('{host}', {port}), timeout=3).close()\n"
            "except OSError:\n    sys.exit(3)",
        ]
    else:  # the two nginx containers have busybox, not Python
        command = ["nc", "-z", "-w", "3", host, str(port)]
    try:
        stack.compose("exec", "-T", service, *command)
    except RuntimeError:
        return False
    return True


def network_isolation(stack: Stack) -> None:
    """The networks of docker-compose.yml, proved from inside the containers (SEC-B-15, admin rule 7)."""
    # Controls first: what is meant to be reachable is, so a "cannot reach" below is not a broken tool.
    check("the API reaches the database", reaches(stack, "back", "db", 5432))
    check("the panel reaches the database", reaches(stack, "panel", "db", 5432))
    check("the public nginx reaches the API", reaches(stack, "front", "back", 8000))
    check("the admin nginx reaches the panel", reaches(stack, "admin", "panel", 8000))
    check("the public API cannot reach the panel", not reaches(stack, "back", "panel", 8000))
    check("the panel cannot reach the public API", not reaches(stack, "panel", "back", 8000))
    check("the public nginx cannot reach the panel", not reaches(stack, "front", "panel", 8000))
    check("the public nginx cannot reach the database", not reaches(stack, "front", "db", 5432))
    check("the admin nginx cannot reach the public API", not reaches(stack, "admin", "back", 8000))
    check("the admin nginx cannot reach the database", not reaches(stack, "admin", "db", 5432))
    check("the API cannot reach the internet", not reaches(stack, "back", "1.1.1.1", 443))
    check("the panel cannot reach the internet", not reaches(stack, "panel", "1.1.1.1", 443))


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--project", default="kidsup_check", help="the throw-away compose project (never 'kidsup')"
    )
    parser.add_argument("--public", default="http://127.0.0.1:18080", help="address of the public site")
    parser.add_argument("--admin", default="http://127.0.0.1:18081", help="address of the admin origin")
    args = parser.parse_args()
    if args.project == REAL_PROJECT:
        print("Refusing to run against the real project: it creates test accounts, applications and courses.")
        return 2
    stack = Stack(args.project, args.public, args.admin)
    admin = Staff(stack, "admin")
    sign_in_and_sessions(stack, admin)
    first_course = registration_and_statuses(stack, admin)
    courses_and_limits(stack, admin, first_course)
    found = admin.find("TEST Valideyn Bir")
    roles(stack, found["id"] if found else "")
    landing_page_content(stack, admin)
    signing_out(admin)
    network_isolation(stack)
    failed = [name for name, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
