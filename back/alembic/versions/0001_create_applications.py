"""create applications

Revision ID: 0001
Revises:
Create Date: 2026-10-12
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("parent_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("languages", sa.ARRAY(sa.String(16)), nullable=False),
        sa.Column("status", sa.String(16), server_default="new", nullable=False),
    )
    op.create_table(
        "application_children",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id", sa.Uuid(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
    )
    op.create_index("ix_application_children_application_id", "application_children", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_application_children_application_id", table_name="application_children")
    op.drop_table("application_children")
    op.drop_table("applications")
