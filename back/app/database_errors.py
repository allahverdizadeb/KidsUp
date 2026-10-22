"""The SQLSTATE codes of the course rules (alembic/versions/0006), and how to read them.

The rules live in the database so that they hold whoever writes the rows; the services turn these codes into
their own exceptions, and the text of the database error is never shown to a caller (SEC-B-12).
"""

import psycopg
from sqlalchemy.exc import DBAPIError

REGISTRATION_CLOSED = "KU001"  # the course is closed, full or unknown, or no single course is open
NOT_ENOUGH_SEATS = "KU002"  # approving would take more places than the course has
CAPACITY_BELOW_APPROVED = "KU003"  # the new capacity is smaller than the number of approved children


def sqlstate_of(error: DBAPIError) -> str | None:
    original = error.orig
    return original.sqlstate if isinstance(original, psycopg.Error) else None
