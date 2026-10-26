"""add the end date of a course

Why: the admin panel shows how long a course runs (its start and end date, "6 həftə") and names it after
its dates, as its design asks. The end date is optional: the course that exists keeps an empty end date until
staff set it, nothing is guessed. When there is one, it cannot be before the start.

No row is touched.

Reversible: the column and its check are dropped.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-23
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("end_date", sa.Date(), nullable=True))
    op.create_check_constraint(
        "ck_courses_end_not_before_start", "courses", "end_date IS NULL OR end_date >= start_date"
    )


def downgrade() -> None:
    op.drop_constraint("ck_courses_end_not_before_start", "courses", type_="check")
    op.drop_column("courses", "end_date")
