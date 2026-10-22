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

# More applications than this falling due on one day means something is wrong (the host's clock jumped,
# say): the job stops and asks a person instead of deleting them (`--force` after checking).
MAX_EXPIRED_PER_RUN = 50


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    purge = commands.add_parser(
        "purge-expired",
        help=f"delete applications that were not approved after {settings.retention_days} days",
    )
    purge.add_argument("--dry-run", action="store_true", help="only count what would be deleted")
    purge.add_argument(
        "--force",
        action="store_true",
        help=f"delete even if more than {MAX_EXPIRED_PER_RUN} applications are due "
        "(check with --dry-run first)",
    )

    erase = commands.add_parser(
        "erase-application", help="really delete one application at a parent's request"
    )
    erase.add_argument("application_id", type=uuid.UUID)
    commands.add_parser(
        "erase-by-phone",
        help="really delete every application with a phone number at a parent's request (asks for it)",
    )
    return parser


def purge_expired(db: Session, dry_run: bool, force: bool) -> int:
    now = datetime.now(UTC)
    due = retention.count_expired_applications(db, now, settings.retention_days)
    if dry_run:
        logger.info("applications that would be deleted: %d", due)
        return 0
    if due > MAX_EXPIRED_PER_RUN and not force:
        logger.error(
            "%d applications are due, more than the %d one run deletes by itself: nothing was deleted. "
            "Check the host's clock and `purge-expired --dry-run`, then run again with --force.",
            due,
            MAX_EXPIRED_PER_RUN,
        )
        return 1
    logger.info(
        "expired applications deleted: %d",
        retention.delete_expired_applications(db, now, settings.retention_days),
    )
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
    # End the read: the operator may take minutes to look at the list, and the database closes a session that
    # sits in an open transaction for longer than a minute (it would kill the erasure that follows).
    db.rollback()
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
                return purge_expired(db, args.dry_run, args.force)

            case "erase-application":
                return erase_application(db, args.application_id)
            case "erase-by-phone":
                return erase_by_phone(db)
            case _:
                raise AssertionError(args.command)


if __name__ == "__main__":
    sys.exit(main())
