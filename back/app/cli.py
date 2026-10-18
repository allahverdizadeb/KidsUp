"""Operator commands. Run them inside the API container:

    docker compose exec back python -m app.cli --help

They print counts only, never names, phone numbers or other personal data (SEC-B-10).
"""

import argparse
import logging
import sys
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from app.config import settings
from app.db import SessionLocal
from app.services import retention

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser(
        "purge-expired",
        help=f"delete applications that never led to enrolment after {settings.retention_days} days",
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


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    args = build_parser().parse_args(argv)
    with SessionLocal() as db:
        if args.command == "purge-expired":
            count = retention.delete_expired_applications(db, datetime.now(UTC), settings.retention_days)
            logger.info("expired applications deleted: %d", count)
        elif args.command == "erase-application":
            if not retention.erase_application(db, args.application_id):
                logger.warning("no application with that id")
                return 1
            logger.info("application erased")
        else:
            # Asked for on the terminal, not passed as an argument: arguments end up in the shell history.
            phone = input("Phone number to erase: ")
            count = retention.erase_applications_by_phone(db, phone)
            logger.info("applications erased: %d", count)
            if count == 0:
                return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
