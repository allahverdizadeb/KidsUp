"""create application notes

Why: staff write internal notes on an application ("called Monday, will decide by Friday"). A note belongs to
one application and goes with it when the application is deleted, by retention or at a parent's request, so
erasing a family really erases everything staff wrote about it (SEC-B-09). A note is never shown to the
family and never leaves the admin panel.

`admin_id` is the author; it is emptied if the account is ever removed, the note stays.

Reversible: dropping the table discards every note.

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "application_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Uuid(),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(btrim(body)) > 0", name="ck_application_notes_body_not_blank"),
    )
    op.create_index("ix_application_notes_application_id", "application_notes", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_application_notes_application_id", table_name="application_notes")
    op.drop_table("application_notes")
