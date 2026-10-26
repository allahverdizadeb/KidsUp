"""The operator's commands for the admin accounts: the only way to create or change one (SEC-B-03)."""

import logging
import re
import runpy
import sys

import pyotp
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import AdminRole, AdminSession, AdminUser, AuditEntry
from app.panel import cli
from app.panel.errors import PanelError
from tests.panel.support import BASE_URL, OFFICE, FakeClock, Staff, sign_in, signed_in

NEW_PASSWORD = "a long password for the new person"


@pytest.fixture(autouse=True)
def the_panels_key(monkeypatch, secret_key):
    monkeypatch.setattr(settings, "panel_secret_key", secret_key)


def admin_row(email: str) -> AdminUser | None:
    with SessionLocal() as db:
        return db.scalars(select(AdminUser).where(AdminUser.email == email)).one_or_none()


def create_command(email: str = "new.person@example.test", role: str = "coordinator") -> list[str]:
    return ["create-admin", "--email", email, "--name", "New Person", "--role", role]


class Terminal:
    """Runs a command with the prompts answered, remembering what the command printed."""

    def __init__(self, capsys, clock: FakeClock, monkeypatch) -> None:
        self.capsys, self.clock, self.shown = capsys, clock, ""
        self.passwords: list[str] = []
        self.code: str | None = None
        self.layout = "{code}"
        monkeypatch.setattr("getpass.getpass", lambda _prompt: self.passwords.pop(0))
        monkeypatch.setattr("builtins.input", self.code_for_the_secret_shown)

    def code_for_the_secret_shown(self, _prompt: str) -> str:
        if self.code is not None:
            return self.code
        self.shown += self.capsys.readouterr().out
        secret = re.search(r"secret: (\w+)", self.shown)
        assert secret is not None
        code = pyotp.TOTP(secret.group(1)).at(self.clock())
        return self.layout.format(code=code, first=code[:3], second=code[3:])  # as a person may type it

    def run(
        self,
        *argv: str,
        passwords: tuple[str, ...] = (),
        code: str | None = None,
        layout: str = "{code}",
    ) -> int:
        self.passwords, self.code, self.shown, self.layout = list(passwords), code, "", layout
        status = cli.main(list(argv), self.clock)
        self.shown += self.capsys.readouterr().out
        return status


@pytest.fixture
def terminal(capsys, clock, monkeypatch) -> Terminal:
    return Terminal(capsys, clock, monkeypatch)


# --- creating an account


def test_a_new_account_can_sign_in_with_the_password_and_the_code_from_its_authenticator(
    terminal, panel_app, clock, caplog
):
    with caplog.at_level(logging.INFO, logger="app.panel.cli"):
        status = terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD))

    assert status == 0
    created = admin_row("new.person@example.test")
    assert created is not None
    assert (created.role, created.display_name, created.is_active) == ("coordinator", "New Person", True)
    secret = re.search(r"secret: (\w+)", terminal.shown)
    assert secret is not None
    staff = Staff(
        id=created.id, email=created.email, role=created.role, password=NEW_PASSWORD, secret=secret.group(1)
    )
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(client, staff, clock).status_code == 201
    assert "account created: new.person@example.test (coordinator)" in caplog.text
    assert NEW_PASSWORD not in caplog.text + terminal.shown


def test_the_secret_is_shown_once_with_the_address_an_authenticator_app_reads(terminal):
    terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD))

    assert "otpauth://totp/KidsUp:new.person%40example.test?secret=" in terminal.shown
    assert "issuer=KidsUp" in terminal.shown


def test_nothing_is_created_when_the_two_passwords_differ(terminal, caplog):
    status = terminal.run(*create_command(), passwords=(NEW_PASSWORD, "another one entirely"))

    assert status == 1
    assert admin_row("new.person@example.test") is None
    assert "differ" in caplog.text


def test_nothing_is_created_when_the_code_is_wrong(terminal, caplog):
    status = terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD), code="000000")

    assert status == 1
    assert admin_row("new.person@example.test") is None
    assert "code is wrong" in caplog.text


@pytest.mark.parametrize(
    "layout",
    ["{first} {second}", "{first}-{second}", "  {code}  ", "{first} {second}"],
    ids=["a space, as the app shows it", "a dash", "spaces around it", "a non-breaking space"],
)
def test_the_code_may_be_typed_as_the_authenticator_app_shows_it(terminal, layout):
    status = terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD), layout=layout)

    assert status == 0
    assert admin_row("new.person@example.test") is not None


@pytest.mark.parametrize("typed", ["abc 123 xyz", "12345", "1234567", "", "one two three"])
def test_dropping_the_spaces_of_a_code_does_not_make_a_wrong_one_pass(terminal, caplog, typed):
    status = terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD), code=typed)

    assert status == 1
    assert admin_row("new.person@example.test") is None
    assert "code is wrong" in caplog.text


def test_a_weak_password_is_refused_without_saying_more_than_the_rule(terminal, caplog):
    status = terminal.run(*create_command(), passwords=("short", "short"))

    assert status == 1
    assert admin_row("new.person@example.test") is None
    assert "min_length" in caplog.text
    assert "short" not in caplog.text.replace("min_length", "")


def test_a_second_account_with_the_same_e_mail_is_refused(terminal, staff, caplog):
    status = terminal.run(*create_command(email=staff.email), passwords=(NEW_PASSWORD, NEW_PASSWORD))

    assert status == 1
    assert "exists already" in caplog.text


def test_the_password_cannot_be_given_as_an_argument(terminal):
    with pytest.raises(SystemExit):
        terminal.run(*create_command(), "--password", NEW_PASSWORD)


def test_a_role_that_does_not_exist_is_refused(terminal):
    with pytest.raises(SystemExit):
        terminal.run(*create_command(role="superuser"))


def test_the_creation_of_an_account_is_in_the_audit_log(terminal):
    terminal.run(*create_command(), passwords=(NEW_PASSWORD, NEW_PASSWORD))

    with SessionLocal() as db:
        entry = db.scalars(
            select(AuditEntry).where(
                AuditEntry.action == "admin_created", AuditEntry.admin_email == "operator"
            )
        ).one()
    assert entry.detail == {"role": "coordinator"}


# --- changing an account


def test_a_new_password_replaces_the_old_one_ends_the_sessions_and_lifts_a_lock(
    terminal, panel_app, staff, clock
):
    browser = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    signed_in(browser, staff, clock)
    with SessionLocal() as db:
        db.get(AdminUser, staff.id).failed_logins = 7  # type: ignore[union-attr]
        db.commit()

    status = terminal.run("reset-password", staff.email, passwords=(NEW_PASSWORD, NEW_PASSWORD))

    assert status == 0
    assert browser.get("/api/admin/sessions/current").status_code == 401
    fresh = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(fresh, staff, clock).status_code == 401  # the old password
    staff.password = NEW_PASSWORD
    assert sign_in(fresh, staff, clock).status_code == 201


def test_nothing_changes_when_the_two_new_passwords_differ(terminal, panel_app, staff, clock, caplog):
    status = terminal.run("reset-password", staff.email, passwords=(NEW_PASSWORD, "another one entirely"))

    assert status == 1
    assert "differ" in caplog.text
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(client, staff, clock).status_code == 201  # the old password still works


def test_nothing_changes_when_the_new_authenticator_is_not_proved(terminal, panel_app, staff, clock, caplog):
    status = terminal.run("reset-second-factor", staff.email, code="000000")

    assert status == 1
    assert "code is wrong" in caplog.text
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    assert sign_in(client, staff, clock).status_code == 201  # the old authenticator still works


def test_a_password_longer_than_the_panel_takes_is_refused_by_the_command_too(terminal, caplog):
    too_long = "ab12" * 33  # 132 characters

    status = terminal.run(*create_command(), passwords=(too_long, too_long))

    assert status == 1
    assert admin_row("new.person@example.test") is None
    assert "max_length" in caplog.text


def test_a_new_authenticator_replaces_the_old_one(terminal, panel_app, staff, clock):
    old_secret = staff.secret

    status = terminal.run("reset-second-factor", staff.email)

    assert status == 0
    new_secret = re.search(r"secret: (\w+)", terminal.shown)
    assert new_secret is not None
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    staff.secret = old_secret
    assert sign_in(client, staff, clock).status_code == 401
    staff.secret, staff.last_step = new_secret.group(1), None
    assert sign_in(client, staff, clock).status_code == 201


def test_a_new_authenticator_ends_the_sessions_that_were_opened_with_the_old_one(
    terminal, panel_app, staff, clock
):
    browser = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    signed_in(browser, staff, clock)
    assert browser.get("/api/admin/sessions/current").status_code == 200

    assert terminal.run("reset-second-factor", staff.email) == 0

    assert browser.get("/api/admin/sessions/current").status_code == 401


def test_changing_the_role_ends_the_sessions_and_changes_what_the_account_may_do(
    terminal, panel_app, staff, clock
):
    browser = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    headers = signed_in(browser, staff, clock)
    assert browser.get("/api/admin/audit", headers=headers).status_code == 200

    assert terminal.run("set-role", staff.email, "viewer") == 0

    assert browser.get("/api/admin/audit").status_code == 401  # signed out by the change
    fresh = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    again = signed_in(fresh, staff, clock)
    assert fresh.get("/api/admin/audit", headers=again).status_code == 403
    assert fresh.get("/api/admin/applications/pulse", headers=again).status_code == 200


def test_a_switched_off_account_cannot_sign_in_until_it_is_switched_on_again(
    terminal, panel_app, staff, clock
):
    browser = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    signed_in(browser, staff, clock)

    assert terminal.run("deactivate", staff.email) == 0

    assert browser.get("/api/admin/sessions/current").status_code == 401
    assert sign_in(browser, staff, clock).status_code == 401
    assert terminal.run("activate", staff.email) == 0
    assert sign_in(browser, staff, clock).status_code == 201


def test_a_locked_account_can_be_unlocked(terminal, panel_app, staff, clock):
    client = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    for _ in range(5):
        sign_in(client, staff, clock, password="wrong wrong wrong wrong", code="000000")
    assert sign_in(client, staff, clock).status_code == 401

    assert terminal.run("unlock", staff.email) == 0

    assert sign_in(client, staff, clock).status_code == 201


def test_every_change_is_audited_and_no_session_survives_a_change_that_could_lock_someone_out(
    terminal, panel_app, staff, clock
):
    browser = TestClient(panel_app, base_url=BASE_URL, client=(OFFICE, 50000))
    signed_in(browser, staff, clock)
    terminal.run("deactivate", staff.email)

    with SessionLocal() as db:
        changes = [
            entry.detail
            for entry in db.scalars(select(AuditEntry).where(AuditEntry.action == "admin_changed"))
        ]
        revoked = db.scalars(select(AdminSession.revoked_at).where(AdminSession.admin_id == staff.id)).all()
    assert changes == [{"change": "deactivated"}]
    assert all(moment is not None for moment in revoked)


def test_a_command_for_an_account_that_does_not_exist_changes_nothing_and_says_so(terminal, caplog):
    status = terminal.run("deactivate", "nobody@example.test")

    assert status == 1
    assert "no account with that e-mail address" in caplog.text


def test_the_list_shows_who_has_access_and_never_a_secret_or_a_hash(terminal, staff, make_staff, caplog):
    other = make_staff(AdminRole.VIEWER)
    with caplog.at_level(logging.INFO, logger="app.panel.cli"):
        status = terminal.run("list-admins")

    assert status == 0
    assert staff.email in caplog.text
    assert other.email in caplog.text
    assert "viewer" in caplog.text
    for secret in (staff.secret, "$argon2", staff.password):
        assert secret not in caplog.text


# --- how the command starts


def test_a_refusal_of_any_other_kind_is_reported_with_its_trace_and_a_failing_status(monkeypatch, caplog):
    def refuse(*_arguments):
        raise PanelError

    monkeypatch.setattr(cli, "run", refuse)

    assert cli.main(["list-admins"]) == 1
    assert "the change was refused" in caplog.text


def test_without_the_panels_key_nothing_runs(monkeypatch, caplog):
    monkeypatch.setattr(settings, "panel_secret_key", None)

    assert cli.main(["list-admins"]) == 2
    assert "KIDSUP_PANEL_SECRET_KEY" in caplog.text


def test_an_unknown_command_is_refused():
    with pytest.raises(SystemExit):
        cli.main(["drop-everything"])


def test_a_command_added_to_the_parser_without_a_handler_fails_loudly(monkeypatch):
    import argparse

    class ParserWithAForgottenCommand:
        def parse_args(self, argv):
            return argparse.Namespace(command="forgotten")

    monkeypatch.setattr(cli, "build_parser", ParserWithAForgottenCommand)

    with pytest.raises(AssertionError, match="forgotten"):
        cli.main([])


@pytest.mark.filterwarnings("ignore:'app.panel.cli' found in sys.modules:RuntimeWarning")
def test_running_the_module_as_a_script_exits_with_the_command_status(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["python -m app.panel.cli", "deactivate", "nobody@example.test"])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("app.panel.cli", run_name="__main__")
    assert exit_info.value.code == 1
