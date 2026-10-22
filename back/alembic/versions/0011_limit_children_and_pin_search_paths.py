"""limit the children of an application, and close the search path of the database functions

Why: rules that must hold whoever writes the rows belong in the database (SEC-B-07).

* An application brings one or two children: the form and the API allow no more. The database now says so
  too: a child has the position 0 or 1, and no application has two children at the same position. Without
  it, an account that can insert (the public API's) could attach any number of children to one application,
  and staff approving it would then take that many places of a course.
* The functions of migration 0006 and 0008 name `pg_temp` last in their search path, as PostgreSQL advises for
  every function that runs with the owner's rights. All their relations are schema-qualified already and the
  runtime accounts have no right to make temporary tables, so this closes a door that was shut; it stays shut
  if one of those two things is ever loosened.

No row is touched. If a database holds a child at another position, or two children at one position, the
constraint cannot be added: the migration stops, nothing is changed, and the rows are for a person to look at.

Reversible: the two constraints are dropped and the search paths are what they were.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-22
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

FUNCTIONS = (
    "course_seats_taken(uuid)",
    "course_accepts_applications(uuid)",
    "applications_pick_course()",
    "applications_guard_seats()",
    "courses_guard_capacity()",
    "audit_log_refuse_changes()",
)


def upgrade() -> None:
    op.create_check_constraint(
        "ck_application_children_position_range", "application_children", "position BETWEEN 0 AND 1"
    )
    op.create_unique_constraint(
        "uq_application_children_position", "application_children", ["application_id", "position"]
    )
    for function in FUNCTIONS:
        op.execute(f"ALTER FUNCTION {function} SET search_path = pg_catalog, public, pg_temp")


def downgrade() -> None:
    for function in FUNCTIONS:
        op.execute(f"ALTER FUNCTION {function} SET search_path = pg_catalog, public")
    op.drop_constraint("uq_application_children_position", "application_children", type_="unique")
    op.drop_constraint("ck_application_children_position_range", "application_children", type_="check")
