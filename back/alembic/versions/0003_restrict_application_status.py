"""restrict application status

Why: the retention job deletes applications by status (SEC-B-09). A status it does not know about would never
be deleted, or, worse, be deleted by a rule written for another one. The database now accepts only the two
statuses the code knows. A new status needs a migration, and with it a decision on how long such applications
are kept.

Every existing row has the default status "new", so nothing is rewritten. Reversible, with no data loss.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-19
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_applications_status_known", "applications", "status IN ('new', 'enrolled')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_applications_status_known", "applications", type_="check")
