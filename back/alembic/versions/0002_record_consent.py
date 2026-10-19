"""record consent

Why: the parent's consent to the privacy notice must be recorded, not just asked for (SEC-F-16, SEC-B-09).
Adds the time of consent and the version of the notice it was given for. Rows that exist already predate the
notice, so both columns stay empty for them; the check keeps the two always filled (or empty) together.

Reversible, but downgrading discards every recorded consent.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-18
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("consent_given_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("privacy_notice_version", sa.String(32), nullable=True))
    op.create_check_constraint(
        "ck_applications_consent_recorded_together",
        "applications",
        "(consent_given_at IS NULL) = (privacy_notice_version IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_applications_consent_recorded_together", "applications", type_="check")
    op.drop_column("applications", "privacy_notice_version")
    op.drop_column("applications", "consent_given_at")
