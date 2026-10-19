"""The operator commands (SEC-B-09, SEC-B-10)."""

import argparse
import logging
import runpy
import sys
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app import cli
from app.bootstrap import connect
from app.db import SessionLocal
from app.models import Application
from app.schemas.application import ApplicationCreate
from app.services import applications as service
from tests.test_applications import VALID, with_
from tests.test_retention import RETENTION_DAYS, add_application, stored_application_ids

PHONE = "+994 50 123 45 67"


def type_in(monkeypatch, *answers: str) -> None:
    replies = iter(answers)
    monkeypatch.setattr("builtins.input", lambda _prompt: next(replies))


def test_purging_deletes_the_expired_applications():
    today = datetime.now(UTC)  # the command uses the real clock
    expired = add_application(age_days=RETENTION_DAYS + 30, now=today)
    recent = add_application(age_days=1, now=today)

    assert cli.main(["purge-expired"]) == 0

    assert stored_application_ids() == {recent}
    assert expired not in stored_application_ids()


def test_a_dry_run_only_counts(caplog):
    today = datetime.now(UTC)
    expired = add_application(age_days=RETENTION_DAYS + 30, now=today)

    with caplog.at_level(logging.INFO, logger="app.cli"):
        assert cli.main(["purge-expired", "--dry-run"]) == 0

    assert stored_application_ids() == {expired}
    assert "would be deleted: 1" in caplog.text


def test_marking_an_application_as_enrolled_keeps_it_out_of_the_purge():
    today = datetime.now(UTC)
    old = add_application(age_days=RETENTION_DAYS + 30, now=today)

    assert cli.main(["mark-enrolled", str(old)]) == 0
    assert cli.main(["purge-expired"]) == 0

    assert stored_application_ids() == {old}


def test_marking_an_unknown_application_reports_failure():
    assert cli.main(["mark-enrolled", str(uuid.uuid4())]) == 1


def test_erasing_one_application_by_id():
    erased = add_application(age_days=1)

    assert cli.main(["erase-application", str(erased)]) == 0
    assert cli.main(["erase-application", str(erased)]) == 1  # already gone

    assert stored_application_ids() == set()


def test_erasing_by_phone_deletes_what_was_listed_once_the_count_is_typed_back(monkeypatch):
    add_application(age_days=1, phone=PHONE)
    add_application(age_days=2, phone="050 123 45 67")
    other = add_application(age_days=1, phone="+994 55 765 43 21")
    type_in(monkeypatch, "0501234567", "2")

    assert cli.main(["erase-by-phone"]) == 0

    assert stored_application_ids() == {other}


@pytest.mark.parametrize("confirmation", ["", "1", "3", "yes", "2 applications"])
def test_erasing_by_phone_deletes_nothing_unless_the_exact_count_is_typed_back(monkeypatch, confirmation):
    add_application(age_days=1, phone=PHONE)
    add_application(age_days=2, phone=PHONE)
    type_in(monkeypatch, PHONE, confirmation)

    assert cli.main(["erase-by-phone"]) == 1

    assert len(stored_application_ids()) == 2


def test_erasing_by_a_phone_nobody_gave_reports_failure(monkeypatch):
    kept = add_application(age_days=1, phone=PHONE)
    type_in(monkeypatch, "+994 55 765 43 21")

    assert cli.main(["erase-by-phone"]) == 1

    assert stored_application_ids() == {kept}


def test_erasing_by_a_number_that_is_too_short_reports_failure(monkeypatch):
    kept = add_application(age_days=1, phone=PHONE)
    type_in(monkeypatch, "12345")

    assert cli.main(["erase-by-phone"]) == 1

    assert stored_application_ids() == {kept}


def test_the_phone_number_is_asked_for_on_the_terminal_not_taken_from_the_arguments():
    # Arguments end up in the shell history.
    with pytest.raises(SystemExit) as exit_info:
        cli.main(["erase-by-phone", PHONE])
    assert exit_info.value.code == 2


def test_an_unknown_command_is_refused():
    with pytest.raises(SystemExit):
        cli.main(["drop-everything"])


def test_a_command_added_to_the_parser_without_a_handler_fails_loudly(monkeypatch):
    # A forgotten branch must never fall through into one of the destructive ones.
    class ParserWithAForgottenCommand:
        def parse_args(self, argv):
            return argparse.Namespace(command="forgotten")

    monkeypatch.setattr(cli, "build_parser", ParserWithAForgottenCommand)

    with pytest.raises(AssertionError, match="forgotten"):
        cli.main([])


@pytest.mark.parametrize(
    "arguments",
    [["purge-expired"], ["erase-by-phone"], ["erase-application", "ID"], ["mark-enrolled", "ID"]],
    ids=lambda arguments: arguments[0],
)
def test_the_commands_log_no_name_and_no_phone_number(monkeypatch, caplog, arguments):
    add_application(age_days=1, phone=PHONE)
    with SessionLocal() as db:
        stored_id = db.scalar(select(Application.id))
    type_in(monkeypatch, PHONE, "1")

    with caplog.at_level(logging.DEBUG):
        cli.main([str(stored_id) if argument == "ID" else argument for argument in arguments])

    # Only things that cannot occur in an application id or a date by chance.
    for personal in ("Aysel", "Leyla", PHONE, "501234567", "0501234567", "2016-03-14"):
        assert personal not in caplog.text


def test_the_operator_commands_work_with_only_the_retention_account(provisioned, monkeypatch):
    # The real flow: the API's limited account stores applications; the commands use the retention account.
    api = sessionmaker(bind=create_engine(provisioned.app, hide_parameters=True))
    with api() as db:
        service.create_application(db, ApplicationCreate.model_validate(VALID))
        service.create_application(db, ApplicationCreate.model_validate(with_(phone="055 765 43 21")))
    with connect(provisioned.admin) as conn:
        conn.execute(
            "UPDATE applications SET created_at = now() - interval '400 days' WHERE phone = '055 765 43 21'"
        )
    monkeypatch.setattr(
        cli, "SessionLocal", sessionmaker(bind=create_engine(provisioned.retention, hide_parameters=True))
    )

    assert cli.main(["purge-expired", "--dry-run"]) == 0
    assert cli.main(["purge-expired"]) == 0  # the 400-day-old application
    with connect(provisioned.admin) as conn:
        remaining = conn.execute("SELECT id FROM applications").fetchall()
    assert len(remaining) == 1

    assert cli.main(["mark-enrolled", str(remaining[0][0])]) == 0
    type_in(monkeypatch, "050 123 45 67", "1")
    assert cli.main(["erase-by-phone"]) == 0
    with connect(provisioned.admin) as conn:
        assert conn.execute("SELECT count(*) FROM applications").fetchone() == (0,)
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (0,)

    another = uuid.uuid4()
    assert cli.main(["erase-application", str(another)]) == 1


@pytest.mark.filterwarnings("ignore:'app.cli' found in sys.modules:RuntimeWarning")
def test_running_the_module_as_a_script_exits_with_the_command_status(monkeypatch):
    monkeypatch.setattr(sys, "argv", ["python -m app.cli", "erase-application", str(uuid.uuid4())])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_module("app.cli", run_name="__main__")
    assert exit_info.value.code == 1  # no such application
