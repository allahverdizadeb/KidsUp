"""What each database account may do, table by table and column by column (SEC-B-07).

Anything not listed here is not allowed. `app/bootstrap.py` turns these lists into GRANT statements, and the
start-up checks of `app/privileges.py` compare the real database with them, so a wider (or narrower)
account is caught whatever it is called.
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Grant:
    """What one account may do with one table."""

    table: str
    privileges: tuple[str, ...] = ()  # on the whole table
    readable_columns: tuple[str, ...] = ()  # SELECT on these columns only
    insertable_columns: tuple[str, ...] = ()  # INSERT on these columns only
    writable_columns: tuple[str, ...] = ()  # UPDATE on these columns only


# The public API adds an application and its children and cannot read anything back (the ORM does not need
# to: `eager_defaults` is off in models.py). It may not choose the status, the time of the last status change
# or the creation time of an application: those are left out of its INSERT right, so a new application always
# starts as `new`, at the database's clock, and only staff move it on. An account that could insert
# `approved` rows would take the seats of a course and close registration for everybody.
APP_GRANTS = (
    Grant(
        "applications",
        insertable_columns=(
            "id",
            "parent_name",
            "phone",
            "languages",
            "course_id",
            "consent_given_at",
            "privacy_notice_version",
        ),
    ),
    Grant("application_children", privileges=("INSERT",)),
)

# The retention job and the operator's commands: find what to delete by status, age or phone number and
# delete it (the children and the staff's notes follow through ON DELETE CASCADE, which runs as the owner).
RETENTION_GRANTS = (
    Grant(
        "applications",
        privileges=("DELETE",),
        readable_columns=("id", "created_at", "status", "phone"),
    ),
)

# The admin panel's API: staff read applications, change their status, write notes and delete a family's data
# at its request; manage courses and the landing page content; sign in and out; and leave a trace in the audit
# log, which they can read and append to but never change (the database refuses it for everybody).
PANEL_GRANTS = (
    Grant("applications", privileges=("SELECT", "DELETE"), writable_columns=("status", "status_changed_at")),
    Grant("application_children", privileges=("SELECT",)),
    Grant("application_notes", privileges=("SELECT", "INSERT", "DELETE")),
    Grant(
        "courses",
        privileges=("SELECT", "INSERT", "DELETE"),
        writable_columns=(
            "title",
            "start_date",
            "schedule",
            "location",
            "age_min",
            "age_max",
            "price_minor",
            "second_child_price_minor",
            "currency",
            "capacity",
            "registration_open",
            "updated_at",
        ),
    ),
    Grant(
        "admin_users",
        privileges=("SELECT", "INSERT"),
        writable_columns=(
            "display_name",
            "role",
            "password_hash",
            "totp_secret",
            "last_totp_step",
            "is_active",
            "failed_logins",
            "locked_until",
            "last_login_at",
            "password_changed_at",
        ),
    ),
    Grant(
        "admin_sessions",
        privileges=("SELECT", "INSERT", "DELETE"),
        writable_columns=("last_seen_at", "revoked_at"),
    ),
    Grant("audit_log", privileges=("SELECT", "INSERT")),
    Grant(
        "site_content",
        privileges=("SELECT", "INSERT", "DELETE"),
        writable_columns=("value", "updated_at", "updated_by"),
    ),
    Grant("site_publications", privileges=("SELECT", "INSERT")),
    Grant("media_assets", privileges=("SELECT", "INSERT", "DELETE")),
)
