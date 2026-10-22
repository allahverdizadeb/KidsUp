"""widen application status

Why: staff now follow an application through four steps (new, contacted, approved, declined) instead of two.
The retention job deletes by status (SEC-B-09), so the database accepts only the statuses the code knows,
and the decision on how long each is kept is made here: everything except approved is deleted after the
retention period; an approved family is kept (the programme's own rules apply).

The old status "enrolled" meant exactly what "approved" means now, so those rows are renamed, none is lost.
`status_changed_at` records when staff last changed the status (empty until they do).

Reversible without losing a row: "approved" goes back to "enrolled"; "contacted" and "declined" did not exist
before and go back to "new".

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_applications_status_known", "applications", type_="check")
    op.execute("UPDATE applications SET status = 'approved' WHERE status = 'enrolled'")
    op.create_check_constraint(
        "ck_applications_status_known",
        "applications",
        "status IN ('new', 'contacted', 'approved', 'declined')",
    )
    op.add_column("applications", sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "status_changed_at")
    op.drop_constraint("ck_applications_status_known", "applications", type_="check")
    op.execute("UPDATE applications SET status = 'enrolled' WHERE status = 'approved'")
    op.execute("UPDATE applications SET status = 'new' WHERE status IN ('contacted', 'declined')")
    op.create_check_constraint(
        "ck_applications_status_known", "applications", "status IN ('new', 'enrolled')"
    )
