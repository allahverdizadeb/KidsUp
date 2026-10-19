"""Operator commands. Run them inside the retention container, whose account may delete (the API's may not):

    docker compose exec retention python -m app.cli --help

They log counts, application ids and dates, never names, phone numbers or other personal data (SEC-B-10).
"""

import argparse
import logging
import sys
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.logging_config import configure_logging
from app.services import retention

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    purge = commands.add_parser(
        "purge-expired",
        help=f"delete applications that never led to enrolment after {settings.retention_days} days",
    )
    purge.add_argument("--dry-run", action="store_true", help="only count what would be deleted")
    enrolled = commands.add_parser(
        "mark-enrolled", help="keep a family's application out of purge-expired once the child is enrolled"
    )
    enrolled.add_argument("application_id", type=uuid.UUID)
    erase = commands.add_parser(
        "erase-application", help="really delete one application at a parent's request"
    )
    erase.add_argument("application_id", type=uuid.UUID)
    commands.add_parser(
        "erase-by-phone",
        help="really delete every application with a phone number at a parent's request (asks for it)",
    )
    return parser


def purge_expired(db: Session, dry_run: bool) -> int:
    now = datetime.now(UTC)
    if dry_run:
        count = retention.count_expired_applications(db, now, settings.retention_days)
        logger.info("applications that would be deleted: %d", count)
    else:
        count = retention.delete_expired_applications(db, now, settings.retention_days)
        logger.info("expired applications deleted: %d", count)
    return 0


def mark_enrolled(db: Session, application_id: uuid.UUID) -> int:
    if not retention.mark_enrolled(db, application_id):
        logger.warning("no application with that id")
        return 1
    logger.info("application marked as enrolled")
    return 0


def erase_application(db: Session, application_id: uuid.UUID) -> int:
    if not retention.erase_application(db, application_id):
        logger.warning("no application with that id")
        return 1
    logger.info("application erased")
    return 0


def erase_by_phone(db: Session) -> int:
    # Asked for on the terminal, not passed as an argument: arguments end up in the shell history.
    phone = input("Phone number to erase: ")
    try:
        matches = retention.find_applications_by_phone(db, phone)
    except ValueError as error:
        logger.error("%s", error)
        return 1
    if not matches:
        logger.warning("no application with that phone number")
        return 1
    for application_id, created_at in matches:
        logger.info("found %s, created %s", application_id, created_at.date())
    # Typing the count back makes the operator look at how many applications a number is about to remove.
    answer = input(f"Type {len(matches)} to erase these {len(matches)} applications and their children: ")
    if answer.strip() != str(len(matches)):
        logger.warning("not confirmed, nothing was erased")
        return 1
    erased = retention.erase_applications(db, [application_id for application_id, _ in matches])
    logger.info("applications erased: %d", erased)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    configure_logging()
    args = build_parser().parse_args(argv)
    with SessionLocal() as db:
        match args.command:
            case "purge-expired":
                return purge_expired(db, args.dry_run)
            case "mark-enrolled":
                return mark_enrolled(db, args.application_id)
            case "erase-application":
                return erase_application(db, args.application_id)
            case "erase-by-phone":
                return erase_by_phone(db)
            case _:
                raise AssertionError(args.command)


if __name__ == "__main__":
    sys.exit(main())
