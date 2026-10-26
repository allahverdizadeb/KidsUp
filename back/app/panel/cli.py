"""The operator's commands for the admin accounts. Run them inside the panel's container:

    docker compose exec panel python -m app.panel.cli create-admin \
        --email name@example.com --name "Name" --role admin

Passwords are typed at a prompt that does not echo them, never given as arguments (arguments end up in the
shell's history and in the process list). The one-time-code secret is shown once, on the terminal, to be
scanned or typed into an authenticator app, and the account is created only after the person types a code
from that app: an account whose second factor was never set up would lock its owner out.
"""

import argparse
import getpass
import logging
import re
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.logging_config import configure_logging
from app.models import AdminRole
from app.panel.clock import Clock, utc_now
from app.panel.errors import PanelError, WeakPasswordError
from app.panel.services import admins, auth, totp
from app.panel.services.secret_box import SecretBox

logger = logging.getLogger(__name__)

Ask = Callable[[str], str]


@dataclass(frozen=True, slots=True)
class Toolbox:
    """What the commands need from outside: the key, the clock, and the two kinds of question."""

    box: SecretBox
    clock: Clock
    ask: Ask
    ask_secret: Ask  # the answer is not echoed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.panel.cli", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-admin", help="create an account (asks for the password and a code)")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True, help="the name shown in the panel")
    create.add_argument("--role", required=True, choices=[role.value for role in AdminRole])
    commands.add_parser("list-admins", help="list the accounts (no secrets)")
    for name, help_text in (
        ("reset-password", "set a new password (asks for it); ends the account's sessions"),
        ("reset-second-factor", "set up a new authenticator (asks for a code); ends the account's sessions"),
        ("deactivate", "switch the account off; ends its sessions"),
        ("activate", "switch the account on again"),
        ("unlock", "lift the lock after too many wrong attempts"),
    ):
        commands.add_parser(name, help=help_text).add_argument("email")
    role = commands.add_parser("set-role", help="change the role of the account; ends its sessions")
    role.add_argument("email")
    role.add_argument("role", choices=[role.value for role in AdminRole])
    return parser


def ask_for_new_password(tools: Toolbox) -> str | None:
    password = tools.ask_secret("New password: ")
    if tools.ask_secret("Again: ") != password:
        logger.error("the two passwords differ; nothing was changed")
        return None
    return password


def confirm_second_factor(email: str, tools: Toolbox) -> str | None:
    """Show a new secret and return it once the person proves their authenticator has it."""
    secret = totp.new_secret()
    print("Add this account to an authenticator app (scan it, or type the secret in):")
    print(f"  secret: {secret}")  # shown once, on the operator's terminal
    print(f"  address: {totp.provisioning_uri(secret, email)}")  # what a QR code holds
    # An app shows a code as "123 456": the digits are what counts, so a space or a dash is not a mistake.
    code = re.sub(r"[^0-9]", "", tools.ask("Code shown by the app: "))
    if totp.matching_step(secret, code, tools.clock(), None) is None:
        logger.error("the code is wrong; nothing was changed")
        return None
    return secret


def create_admin(db: Session, args: argparse.Namespace, tools: Toolbox) -> int:
    password = ask_for_new_password(tools)
    secret = None if password is None else confirm_second_factor(args.email, tools)
    if password is None or secret is None:
        return 1
    new = auth.NewAdmin(
        email=args.email,
        display_name=args.name,
        role=AdminRole(args.role),
        password=password,
        totp_secret=secret,
    )
    try:
        created = auth.create_admin(db, new, tools.box, admins.OPERATOR)
    except IntegrityError:
        db.rollback()
        logger.error("an account with that e-mail address exists already")
        return 1
    logger.info("account created: %s (%s)", created.email, created.role)
    return 0


def list_admins(db: Session) -> int:
    for admin in admins.list_admins(db):
        state = "active" if admin.is_active else "switched off"
        logger.info(
            "%s | %s | %s | %s | last sign-in %s",
            admin.email,
            admin.display_name,
            admin.role,
            state,
            admin.last_login_at,
        )
    return 0


def change_account(db: Session, args: argparse.Namespace, tools: Toolbox) -> int:
    now = tools.clock()
    match args.command:
        case "reset-password":
            password = ask_for_new_password(tools)
            if password is None:
                return 1
            admins.reset_password(db, args.email, password, now)
        case "reset-second-factor":
            secret = confirm_second_factor(args.email, tools)
            if secret is None:
                return 1
            admins.reset_second_factor(db, args.email, secret, tools.box, now)
        case "set-role":
            admins.set_role(db, args.email, AdminRole(args.role), now)
        case "deactivate":
            admins.set_active(db, args.email, active=False, now=now)
        case "activate":
            admins.set_active(db, args.email, active=True, now=now)
        case "unlock":
            admins.unlock(db, args.email)
        case _:
            raise AssertionError(args.command)
    logger.info("done")
    return 0


def run(db: Session, args: argparse.Namespace, tools: Toolbox) -> int:
    match args.command:
        case "create-admin":
            return create_admin(db, args, tools)
        case "list-admins":
            return list_admins(db)
        case _:
            return change_account(db, args, tools)


def main(argv: Sequence[str] | None = None, clock: Clock = utc_now) -> int:
    configure_logging()
    args = build_parser().parse_args(argv)
    if settings.panel_secret_key is None:
        logger.error("KIDSUP_PANEL_SECRET_KEY is required")
        return 2
    tools = Toolbox(SecretBox(settings.panel_secret_key), clock, input, getpass.getpass)
    with SessionLocal() as db:
        try:
            return run(db, args, tools)
        except admins.NoSuchAdminError:
            logger.error("no account with that e-mail address")
        except WeakPasswordError as error:
            logger.error("that password is not accepted (%s)", error.extra.get("rule"))
        except PanelError:
            logger.exception("the change was refused")
    return 1


if __name__ == "__main__":
    sys.exit(main())
