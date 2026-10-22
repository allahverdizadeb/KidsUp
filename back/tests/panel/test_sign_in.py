"""SEC-B-03, SEC-B-06, SEC-B-10: signing in and out of the admin panel."""

import hashlib
import hmac
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pyotp
import pytest
from argon2 import PasswordHasher
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.db import SessionLocal
from app.models import AdminSession, AdminUser, AuditEntry
from app.panel.errors import InvalidCredentialsError
from app.panel.main import create_panel_app
from app.panel.security import SESSION_COOKIE
from app.panel.services import auth, passwords, totp
from app.panel.services.auth import FREE_FAILURES, LONGEST_LOCK, lock_duration
from app.panel.services.secret_box import SecretBox
from app.panel.services.sessions import SessionTimes
from tests.conftest import make_settings
from tests.panel.support import (
    BASE_URL,
    OFFICE,
    ORIGIN,
    PASSWORD,
    SIGN_IN_URL,
    START,
    Staff,
    add_staff,
    code_for,
    sign_in,
    signed_in,
)

CURRENT_SESSION_URL = "/api/admin/sessions/current"
WRONG_PASSWORD = "wrong wrong wrong wrong"
SESSION_TIMES = SessionTimes(idle=timedelta(minutes=15), lifetime=timedelta(hours=8))


def audit_log() -> list[AuditEntry]:
    """What staff did, oldest first (the creation of the accounts of the tests is left out)."""
    with SessionLocal() as db:
        entries = db.scalars(select(AuditEntry).order_by(AuditEntry.id)).all()
    return [entry for entry in entries if entry.action != "admin_created"]


def stored_admin(staff: Staff) -> AdminUser:
    with SessionLocal() as db:
        return db.scalars(select(AdminUser).where(AdminUser.id == staff.id)).one()


# --- a successful sign-in


def test_signing_in_returns_who_you_are_what_you_may_do_and_the_csrf_token(panel, staff, clock):
    response = sign_in(panel, staff, clock)

    assert response.status_code == 201
    body = response.json()
    assert body["admin"]["email"] == staff.email
    assert body["admin"]["role"] == "admin"
    assert "applications:export" in body["admin"]["permissions"]
    assert len(body["csrf_token"]) >= 32
    assert body["idle_timeout_seconds"] == 15 * 60


def test_the_session_cookie_cannot_be_read_by_scripts_or_sent_across_sites_or_over_http(panel, staff, clock):
    cookie = sign_in(panel, staff, clock).headers["set-cookie"].lower()

    assert cookie.startswith(f"{SESSION_COOKIE.lower()}=")
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=strict" in cookie
    assert "path=/api/admin" in cookie  # the narrowest path that covers the panel's API (SEC-B-06)
    assert "domain" not in cookie  # host-only
    assert "max-age" not in cookie  # ends with the browser session, and on the server after 15 idle minutes


def test_the_database_keeps_only_a_hash_of_the_session_token(panel, staff, clock):
    sign_in(panel, staff, clock)
    token = panel.cookies.get(SESSION_COOKIE)

    with SessionLocal() as db:
        stored = db.scalars(select(AdminSession)).one()
    assert token is not None
    assert stored.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in (stored.token_hash, stored.csrf_token)


def test_the_password_is_stored_as_an_argon2id_hash(staff):
    stored = stored_admin(staff).password_hash

    assert stored.startswith("$argon2id$")
    assert staff.password not in stored


def test_a_hash_made_with_weaker_settings_is_replaced_by_a_current_one_at_the_next_sign_in(
    panel, staff, clock
):
    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(staff.password)
    with SessionLocal() as db:
        db.execute(update(AdminUser).where(AdminUser.id == staff.id).values(password_hash=weak))
        db.commit()

    assert sign_in(panel, staff, clock).status_code == 201

    stored = stored_admin(staff).password_hash
    assert stored != weak
    assert not passwords.needs_rehash(stored)
    assert passwords.verify_password(stored, staff.password)


def test_the_second_factor_secret_is_stored_encrypted_with_a_key_that_is_not_in_the_database(staff, box):
    stored = stored_admin(staff).totp_secret

    assert staff.secret not in stored
    assert box.decrypt(stored) == staff.secret
    assert SecretBox("A" * 43 + "=").decrypt(stored) is None  # another key cannot read it


def test_a_successful_sign_in_is_written_to_the_audit_log_with_the_network_only(panel, staff, clock):
    sign_in(panel, staff, clock)

    (entry,) = audit_log()
    assert (entry.action, entry.admin_id, entry.admin_email) == ("sign_in", staff.id, staff.email)
    assert entry.network == "203.0.113.0/24"
    assert OFFICE not in str(entry.__dict__)  # never the address itself


# --- a failed sign-in looks the same whatever was wrong (no way to find out which accounts exist)


def switch_off(staff: Staff) -> None:
    with SessionLocal() as db:
        db.execute(update(AdminUser).where(AdminUser.id == staff.id).values(is_active=False))
        db.commit()


def detail_of(entry: AuditEntry) -> dict[str, object]:
    assert isinstance(entry.detail, dict)
    return dict(entry.detail)


def reason_of(entry: AuditEntry) -> str:
    return str(detail_of(entry)["reason"])


def failures(panel, staff, clock, make_staff):
    switched_off = make_staff()
    switch_off(switched_off)
    unknown = panel.post(
        SIGN_IN_URL,
        json={"email": "nobody@example.test", "password": PASSWORD, "code": code_for(staff, clock)},
        headers={"Origin": ORIGIN},
    )
    return {
        "unknown e-mail": unknown,
        "wrong password": sign_in(panel, staff, clock, password="not the password at all"),
        "wrong code": sign_in(panel, staff, clock, code="000000"),
        "switched off": sign_in(panel, switched_off, clock),
    }


def test_every_kind_of_failure_gives_the_same_answer(panel, staff, clock, make_staff):
    answers = failures(panel, staff, clock, make_staff)

    assert {(r.status_code, r.text) for r in answers.values()} == {
        (401, '{"detail":"The e-mail, the password or the code is wrong.","code":"invalid_credentials"}')
    }
    assert all("set-cookie" not in answer.headers for answer in answers.values())


def test_the_real_reason_goes_to_the_audit_log_and_an_unknown_e_mail_is_not_copied_there(
    panel, staff, clock, make_staff
):
    failures(panel, staff, clock, make_staff)

    reasons = [reason_of(entry) for entry in audit_log() if entry.action == "sign_in_failed"]
    assert reasons == ["unknown_account", "wrong_password", "wrong_code", "inactive"]
    assert "nobody@example.test" not in str([entry.__dict__ for entry in audit_log()])


def test_an_unknown_e_mail_still_costs_a_password_check_against_a_made_up_hash(panel, monkeypatch):
    # What keeps an unknown account from answering faster than a known one (SEC-B-03).
    checked_against = []
    real_verify = passwords.verify_password

    def spy(stored_hash, password):
        checked_against.append(stored_hash)
        return real_verify(stored_hash, password)

    monkeypatch.setattr(passwords, "verify_password", spy)

    response = panel.post(
        SIGN_IN_URL,
        json={"email": "nobody@example.test", "password": PASSWORD, "code": "123456"},
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 401
    assert checked_against == [passwords.DUMMY_HASH]


def test_every_step_of_the_code_is_compared_whatever_the_first_comparison_says(monkeypatch):
    compared: list[str] = []
    real_compare = hmac.compare_digest

    def counting_compare(a: str, b: str) -> bool:
        compared.append(a)
        return real_compare(a, b)

    monkeypatch.setattr(hmac, "compare_digest", counting_compare)
    secret = totp.new_secret()
    step = totp.step_of(START)
    right_code = pyotp.TOTP(secret).at(step * totp.STEP_SECONDS)

    assert totp.matching_step(secret, right_code, START, None) == step
    assert len(compared) == 2 * totp.DRIFT_STEPS + 1  # not 2: the one that matched did not end the loop

    compared.clear()
    # An account that does not exist is checked against a made-up secret: as many comparisons, never a match,
    # not even for the made-up secret's own right code.
    made_up_secret = totp.__dict__["_ANY_SECRET"]
    its_right_code = pyotp.TOTP(made_up_secret).at(step * totp.STEP_SECONDS)
    assert totp.matching_step(None, its_right_code, START, None) is None
    assert len(compared) == 2 * totp.DRIFT_STEPS + 1


def test_after_the_panels_key_changes_nobody_can_sign_in_and_the_answer_is_the_same(panel, clock):
    other_key = SecretBox(Fernet.generate_key().decode())
    staff_with_the_old_key = add_staff(other_key)

    response = sign_in(panel, staff_with_the_old_key, clock)

    assert (response.status_code, response.json()["code"]) == (401, "invalid_credentials")
    assert SESSION_COOKIE not in panel.cookies


def test_a_code_cannot_be_used_twice(panel, staff, clock):
    code = code_for(staff, clock)
    assert sign_in(panel, staff, clock, code=code).status_code == 201

    assert sign_in(panel, staff, clock, code=code).status_code == 401


def test_a_code_from_the_step_before_or_after_is_accepted_for_clocks_that_differ_a_little(
    panel, staff, clock, make_staff
):
    other = make_staff()
    step = totp.step_of(clock())
    one_step_old = pyotp.TOTP(staff.secret).at((step - 1) * totp.STEP_SECONDS)
    two_steps_old = pyotp.TOTP(other.secret).at((step - 2) * totp.STEP_SECONDS)

    assert sign_in(panel, staff, clock, code=one_step_old).status_code == 201
    assert sign_in(panel, other, clock, code=two_steps_old).status_code == 401


@pytest.mark.parametrize("code", ["12345", "1234567", "abcdef", "12 456", ""])
def test_a_code_that_is_not_six_digits_is_refused_before_anything_is_checked(panel, staff, clock, code):
    assert sign_in(panel, staff, clock, code=code).status_code == 422


def test_a_refused_sign_in_form_never_echoes_what_was_typed(panel, staff, clock):
    # SEC-B-01, SEC-B-12: FastAPI's 422 would repeat the refused value (here a whole password) in `input`.
    too_long = "p" * 129
    typed_code = "12ab56"
    answers = [
        panel.post(
            SIGN_IN_URL,
            json={"email": staff.email, "password": too_long, "code": "123456"},
            headers={"Origin": ORIGIN},
        ),
        panel.post(
            SIGN_IN_URL,
            json={"email": staff.email, "password": PASSWORD, "code": typed_code},
            headers={"Origin": ORIGIN},
        ),
        panel.post(
            SIGN_IN_URL, json={"email": staff.email, "password": PASSWORD}, headers={"Origin": ORIGIN}
        ),
    ]

    assert [answer.status_code for answer in answers] == [422, 422, 422]
    for answer in answers:
        assert too_long not in answer.text
        assert typed_code not in answer.text
        assert PASSWORD not in answer.text
        assert staff.email not in answer.text
        assert all(set(fault) == {"loc", "type"} for fault in answer.json()["detail"])


def test_an_e_mail_with_a_control_character_is_refused_not_passed_to_the_database(panel, staff, clock):
    # A NUL cannot be stored in a PostgreSQL text value: used as a query parameter it ended in a 500.
    for bad in ("a\x00b@example.test", "a\nb@example.test", "a\tb@example.test"):
        response = panel.post(
            SIGN_IN_URL,
            json={"email": bad, "password": PASSWORD, "code": "123456"},
            headers={"Origin": ORIGIN},
        )

        assert response.status_code == 422, repr(bad)


def test_the_e_mail_is_matched_without_regard_to_case_or_spaces(panel, staff, clock):
    response = panel.post(
        SIGN_IN_URL,
        json={"email": f"  {staff.email.upper()} ", "password": PASSWORD, "code": code_for(staff, clock)},
        headers={"Origin": ORIGIN},
    )

    assert response.status_code == 201


# --- guessing is slowed down (SEC-B-03)


@pytest.mark.parametrize(
    ("failures", "locked_for"),
    [(1, None), (FREE_FAILURES, None), (5, 1), (6, 2), (7, 4), (8, 8), (9, 15), (10, 15), (500, 15)],
)
def test_the_lock_doubles_with_every_failure_up_to_a_quarter_of_an_hour(failures, locked_for):
    expected = None if locked_for is None else timedelta(minutes=locked_for)

    assert lock_duration(failures) == expected
    assert expected is None or expected <= LONGEST_LOCK


def guess_wrong(panel, staff, clock, times):
    """Wrong attempts. A made-up code is sent, so the clock does not move to find a new one."""
    for _ in range(times):
        sign_in(panel, staff, clock, password=WRONG_PASSWORD, code="000000")


def test_four_wrong_attempts_do_not_lock_and_a_good_sign_in_clears_the_count(panel, staff, clock):
    guess_wrong(panel, staff, clock, FREE_FAILURES)

    assert sign_in(panel, staff, clock).status_code == 201
    assert stored_admin(staff).failed_logins == 0


def test_the_fifth_wrong_attempt_locks_the_account_even_against_the_right_password(panel, staff, clock):
    guess_wrong(panel, staff, clock, FREE_FAILURES + 1)

    # The right password and a fresh code are still refused while the lock lasts.
    assert sign_in(panel, staff, clock).status_code == 401
    clock.advance(seconds=58)
    assert sign_in(panel, staff, clock).status_code == 401
    clock.advance(seconds=4)
    assert sign_in(panel, staff, clock).status_code == 201


def test_attempts_made_while_the_account_is_locked_do_not_make_the_lock_longer(panel, staff, clock):
    guess_wrong(panel, staff, clock, FREE_FAILURES + 1)
    locked_until = stored_admin(staff).locked_until

    guess_wrong(panel, staff, clock, 20)

    assert stored_admin(staff).locked_until == locked_until
    assert stored_admin(staff).failed_logins == FREE_FAILURES + 1


def test_the_second_lock_is_longer_than_the_first(panel, staff, clock):
    guess_wrong(panel, staff, clock, FREE_FAILURES + 1)
    clock.advance(seconds=61)

    guess_wrong(panel, staff, clock, 1)  # the sixth failure

    assert stored_admin(staff).locked_until == clock() + timedelta(minutes=2)


def test_the_wrong_attempt_that_locks_the_account_says_so_in_the_audit_log(panel, staff, clock):
    guess_wrong(panel, staff, clock, FREE_FAILURES + 1)

    failed = [detail_of(entry) for entry in audit_log() if entry.action == "sign_in_failed"]
    assert [detail["locked"] for detail in failed] == [False] * FREE_FAILURES + [True]


# --- requests that arrive together: the database decides, not the copies of the row the requests read


def attempt(box, clock, staff, code, password=PASSWORD) -> str:
    """One sign-in as its own request would run it: its own database session."""
    context = auth.SignInContext(now=clock(), network=None, box=box, times=SESSION_TIMES)
    with SessionLocal() as db:
        try:
            auth.sign_in(db, auth.Credentials(staff.email, password, code), context)
        except InvalidCredentialsError:
            return "refused"
    return "signed in"


def test_two_sign_ins_with_the_same_code_at_the_same_moment_open_only_one_session(
    staff, box, clock, monkeypatch
):
    # Both read the account (the code not yet used) before either writes. A code works once: the one that
    # writes second must be refused although its copy of the row said the code was fresh.
    meeting = threading.Barrier(2, timeout=10)
    real_verify = passwords.verify_password

    def verify_then_wait_for_the_other(stored_hash, password):
        result = real_verify(stored_hash, password)
        meeting.wait()
        return result

    monkeypatch.setattr(passwords, "verify_password", verify_then_wait_for_the_other)
    code = code_for(staff, clock)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(box, clock, staff, code), range(2)))

    assert sorted(results) == ["refused", "signed in"]
    with SessionLocal() as db:
        assert len(db.scalars(select(AdminSession).where(AdminSession.admin_id == staff.id)).all()) == 1
    failed = [entry for entry in audit_log() if entry.action == "sign_in_failed"]
    assert [reason_of(entry) for entry in failed] == ["wrong_code"]


def test_a_right_guess_that_began_before_the_lock_does_not_get_through_it(staff, box, clock, monkeypatch):
    # The slow request has passed the "is it locked?" test; the fifth wrong attempt is written while it is
    # still hashing. Its success must not open a session on a locked account, nor clear the lock.
    reached_the_end_of_the_checks = threading.Event()
    the_lock_is_in_place = threading.Event()
    real_verify = passwords.verify_password

    def verify(stored_hash, password):
        result = real_verify(stored_hash, password)
        if threading.current_thread().name == "slow":
            reached_the_end_of_the_checks.set()
            assert the_lock_is_in_place.wait(10)
        return result

    monkeypatch.setattr(passwords, "verify_password", verify)
    code = code_for(staff, clock)
    outcome: list[str] = []
    slow = threading.Thread(target=lambda: outcome.append(attempt(box, clock, staff, code)), name="slow")
    slow.start()
    assert reached_the_end_of_the_checks.wait(10)

    for _ in range(FREE_FAILURES + 1):
        assert attempt(box, clock, staff, "000000", WRONG_PASSWORD) == "refused"
    the_lock_is_in_place.set()
    slow.join(10)

    assert outcome == ["refused"]
    locked = stored_admin(staff)
    assert locked.locked_until is not None
    assert locked.failed_logins == FREE_FAILURES + 1  # the late one is not counted on top
    assert reason_of(audit_log()[-1]) == "locked"
    with SessionLocal() as db:
        assert db.scalars(select(AdminSession).where(AdminSession.admin_id == staff.id)).all() == []


def test_when_every_password_check_is_taken_a_sign_in_is_refused_and_not_held_against_the_account(
    panel, staff, clock, monkeypatch
):
    monkeypatch.setattr(passwords, "_slots", threading.BoundedSemaphore(0))
    monkeypatch.setattr(passwords, "WAIT_SECONDS", 0.01)

    response = sign_in(panel, staff, clock)

    assert response.status_code == 503
    assert response.json()["code"] == "busy"
    assert "set-cookie" not in response.headers
    assert stored_admin(staff).failed_logins == 0  # nothing was checked, so nothing failed
    assert audit_log() == []


def test_the_sign_in_is_limited_for_each_address(panel_settings, clock, staff):
    settings = make_settings(**{**panel_settings.model_dump(), "panel_login_rate_limit_per_minute": 3})
    client = TestClient(create_panel_app(settings, clock), base_url=BASE_URL, client=(OFFICE, 50000))

    statuses = [
        sign_in(client, staff, clock, password="wrong wrong wrong wrong").status_code for _ in range(5)
    ]

    assert statuses == [401, 401, 401, 429, 429]
    answer = sign_in(client, staff, clock)
    assert answer.status_code == 429
    assert answer.headers["retry-after"] == "60"


# --- the session (SEC-B-03: short, revocable, bound to the user)


def test_the_session_ends_after_fifteen_idle_minutes_and_activity_keeps_it_alive(panel, staff, clock):
    sign_in(panel, staff, clock)

    clock.advance(minutes=14)
    assert panel.get(CURRENT_SESSION_URL).status_code == 200  # this request is activity
    clock.advance(minutes=14)
    assert panel.get(CURRENT_SESSION_URL).status_code == 200
    clock.advance(minutes=16)
    assert panel.get(CURRENT_SESSION_URL).status_code == 401


def test_a_page_that_only_polls_for_news_does_not_keep_the_session_alive(panel, staff, clock):
    sign_in(panel, staff, clock)

    clock.advance(minutes=10)
    assert panel.get(CURRENT_SESSION_URL, headers={"X-Background": "poll"}).status_code == 200
    clock.advance(minutes=6)  # 16 minutes since the person last did anything

    assert panel.get(CURRENT_SESSION_URL).status_code == 401


def test_the_session_has_an_absolute_end_however_busy_it_was(panel_settings, clock, staff):
    settings = make_settings(**{**panel_settings.model_dump(), "panel_session_max_hours": 1})
    client = TestClient(create_panel_app(settings, clock), base_url=BASE_URL, client=(OFFICE, 50000))
    sign_in(client, staff, clock)

    for _ in range(5):  # busy for 50 minutes
        clock.advance(minutes=10)
        assert client.get(CURRENT_SESSION_URL).status_code == 200
    clock.advance(minutes=11)

    assert client.get(CURRENT_SESSION_URL).status_code == 401


def test_signing_out_ends_the_session_on_the_server_not_only_in_the_browser(panel, staff, clock):
    headers = signed_in(panel, staff, clock)
    token = panel.cookies.get(SESSION_COOKIE)

    response = panel.delete(CURRENT_SESSION_URL, headers=headers)

    assert response.status_code == 204
    assert f"{SESSION_COOKIE}=" in response.headers["set-cookie"]  # the browser is told to forget it
    stolen = {"Cookie": f"{SESSION_COOKIE}={token}"}
    assert (
        TestClient(panel.app, base_url=BASE_URL).get(CURRENT_SESSION_URL, headers=stolen).status_code == 401
    )
    assert [entry.action for entry in audit_log()] == ["sign_in", "sign_out"]


def test_a_session_of_an_account_that_was_switched_off_stops_working(panel, staff, clock):
    sign_in(panel, staff, clock)
    switch_off(staff)

    assert panel.get(CURRENT_SESSION_URL).status_code == 401


def test_without_a_cookie_there_is_no_session(panel):
    assert panel.get(CURRENT_SESSION_URL).status_code == 401


@pytest.mark.parametrize("cookie", ["", "garbage", "A" * 43, "x" * 1000])
def test_a_cookie_that_names_no_session_is_refused(panel, cookie):
    assert panel.get(CURRENT_SESSION_URL, headers={"Cookie": f"{SESSION_COOKIE}={cookie}"}).status_code == 401


def test_the_current_session_says_who_is_signed_in(panel, staff, clock):
    sign_in(panel, staff, clock)

    body = panel.get(CURRENT_SESSION_URL).json()

    assert body["admin"]["email"] == staff.email
    assert body["csrf_token"]


# --- the second line of defence against forged requests (CSRF)


def test_a_request_that_changes_something_needs_the_csrf_token(panel, staff, clock):
    headers = signed_in(panel, staff, clock)

    without_token = panel.delete(CURRENT_SESSION_URL, headers={"Origin": ORIGIN})
    wrong_token = panel.delete(CURRENT_SESSION_URL, headers={"Origin": ORIGIN, "X-CSRF-Token": "x" * 43})

    assert (without_token.status_code, wrong_token.status_code) == (403, 403)
    assert panel.get(CURRENT_SESSION_URL).status_code == 200  # still signed in
    assert panel.delete(CURRENT_SESSION_URL, headers=headers).status_code == 204


def test_a_request_from_another_origin_is_refused_even_with_the_right_token(panel, staff, clock):
    headers = signed_in(panel, staff, clock)

    forged = panel.delete(CURRENT_SESSION_URL, headers={**headers, "Origin": "https://evil.example.test"})

    assert forged.status_code == 403
    assert panel.get(CURRENT_SESSION_URL).status_code == 200


def test_a_request_without_an_origin_header_still_needs_the_token(panel, staff, clock):
    headers = signed_in(panel, staff, clock)
    token_only = {"X-CSRF-Token": headers["X-CSRF-Token"]}

    assert panel.delete(CURRENT_SESSION_URL).status_code == 403
    assert panel.delete(CURRENT_SESSION_URL, headers=token_only).status_code == 204


@pytest.mark.parametrize(
    "origin",
    [
        "null",  # a sandboxed frame or a local file
        "",
        "http://admin.example.test",  # the right host over plain http
        "https://admin.example.test:8443",  # another port
        "https://admin.example.test.",  # a trailing dot
        "https://ADMIN.EXAMPLE.TEST",  # upper case
        "https://admin.example.test.evil.example",  # starts like the panel's origin
        "https://evil.example/https://admin.example.test",  # contains it
        "https://admin.example.test@evil.example",  # user info
    ],
    ids=repr,
)
def test_only_the_exact_origin_of_the_panel_is_trusted(panel, staff, clock, origin):
    headers = signed_in(panel, staff, clock)

    forged = panel.delete(CURRENT_SESSION_URL, headers={**headers, "Origin": origin})

    assert forged.status_code == 403
    assert panel.get(CURRENT_SESSION_URL).status_code == 200  # the session was not touched


def test_signing_in_from_another_origin_is_refused(panel, staff, clock):
    assert sign_in(panel, staff, clock, origin="https://evil.example.test").status_code == 403
    assert SESSION_COOKIE not in panel.cookies


def test_reading_needs_no_csrf_token(panel, staff, clock):
    sign_in(panel, staff, clock)

    assert panel.get(CURRENT_SESSION_URL).status_code == 200


# --- changing the password


NEW_PASSWORD = "another long password nobody guesses"


def change_password(panel, headers, current=PASSWORD, new=NEW_PASSWORD):
    return panel.put(
        "/api/admin/account/password",
        json={"current_password": current, "new_password": new},
        headers=headers,
    )


def test_a_new_password_replaces_the_old_one_and_ends_the_other_sessions(panel, staff, clock, panel_app):
    other_device = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    sign_in(other_device, staff, clock)
    headers = signed_in(panel, staff, clock)

    assert change_password(panel, headers).status_code == 204

    assert other_device.get(CURRENT_SESSION_URL).status_code == 401  # rotated on change (SEC-B-03)
    assert panel.get(CURRENT_SESSION_URL).status_code == 200  # the session that changed it goes on
    fresh = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(fresh, staff, clock, password=PASSWORD).status_code == 401
    assert sign_in(fresh, staff, clock, password=NEW_PASSWORD).status_code == 201
    assert "password_changed" in [entry.action for entry in audit_log()]


def test_the_current_password_must_be_right_to_change_it(panel, staff, clock):
    headers = signed_in(panel, staff, clock)

    response = change_password(panel, headers, current="not the password at all")

    assert response.status_code == 403
    assert response.json()["code"] == "wrong_password"


def test_guessing_the_current_password_in_the_password_form_is_counted_and_ends_in_a_lock(
    panel, staff, clock, panel_app
):
    # Only a session's cookie is needed to reach this form (an unlocked workstation, a stolen cookie): it must
    # not be a way to try passwords without limit (SEC-B-03).
    headers = signed_in(panel, staff, clock)
    for _ in range(FREE_FAILURES):
        assert change_password(panel, headers, current=WRONG_PASSWORD).status_code == 403
    assert panel.get(CURRENT_SESSION_URL).status_code == 200  # four wrong guesses: not locked yet
    assert (stored_admin(staff).failed_logins, stored_admin(staff).locked_until) == (FREE_FAILURES, None)

    fifth = change_password(panel, headers, current=WRONG_PASSWORD)

    assert fifth.status_code == 403
    assert stored_admin(staff).locked_until is not None
    assert panel.get(CURRENT_SESSION_URL).status_code == 401  # every session of the account has ended
    fresh = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(fresh, staff, clock).status_code == 401  # the right password and code: locked
    failed = [detail_of(e) for e in audit_log() if e.action == "password_change_failed"]
    assert [detail["locked"] for detail in failed] == [False] * FREE_FAILURES + [True]
    assert WRONG_PASSWORD not in str([entry.__dict__ for entry in audit_log()])


def test_a_right_current_password_after_wrong_ones_still_works_below_the_lock(panel, staff, clock):
    headers = signed_in(panel, staff, clock)
    change_password(panel, headers, current=WRONG_PASSWORD)

    assert change_password(panel, headers).status_code == 204


def test_the_password_form_is_limited_like_the_sign_in(panel_settings, clock, staff):
    settings = make_settings(**{**panel_settings.model_dump(), "panel_login_rate_limit_per_minute": 3})
    client = TestClient(create_panel_app(settings, clock), base_url=BASE_URL, client=(OFFICE, 50000))
    headers = signed_in(client, staff, clock)  # the sign-in used one of the three

    statuses = [change_password(client, headers, current=WRONG_PASSWORD).status_code for _ in range(4)]

    assert statuses == [403, 403, 429, 429]


def test_a_refused_password_form_never_echoes_what_was_typed(panel, staff, clock):
    headers = signed_in(panel, staff, clock)
    too_long = "n" * 129

    refused = change_password(panel, headers, current=PASSWORD, new=too_long)
    incomplete = panel.put(
        "/api/admin/account/password", json={"current_password": PASSWORD}, headers=headers
    )

    assert (refused.status_code, incomplete.status_code) == (422, 422)
    for answer in (refused, incomplete):
        assert too_long not in answer.text
        assert PASSWORD not in answer.text


@pytest.mark.parametrize(
    ("new", "rule"),
    [
        ("short", "min_length"),
        ("x" * 129, None),  # refused by the schema before the rules
        ("password1234", "too_obvious"),
        ("aaaaaaaaaaaaaaaa", "too_obvious"),
    ],
)
def test_a_weak_new_password_is_refused(panel, staff, clock, new, rule):
    headers = signed_in(panel, staff, clock)

    response = change_password(panel, headers, new=new)

    assert response.status_code == 422
    assert rule is None or response.json()["rule"] == rule
    assert stored_admin(staff).password_hash.startswith("$argon2id$")
    assert sign_in(TestClient(panel.app, base_url=BASE_URL), staff, clock).status_code == 201  # unchanged


def test_the_email_is_not_an_acceptable_password(panel, staff, clock):
    headers = signed_in(panel, staff, clock)

    response = change_password(panel, headers, new=staff.email)

    assert response.status_code == 422
    assert response.json()["rule"] == "too_obvious"
