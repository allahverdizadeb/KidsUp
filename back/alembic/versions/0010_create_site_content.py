"""create the landing page content

Why: staff edit the texts and images of the landing page in the admin panel and publish them.

* `site_content` holds the draft: one JSON value per content key. Which keys exist and
  what each may hold is decided in the code (`app/panel/content_registry.py`); the table is the storage.
* `site_publications` keeps every publication: the whole content at that moment. The newest one is what the
  landing page shows (the panel writes it to a file that nginx serves, so the public site never reads the
  database); older ones stay as the history.
* `media_assets` lists the images staff uploaded. The image itself is a re-encoded file in the content volume.

Nothing here is personal data.

Reversible: the three tables are dropped, which discards the draft, the history and the list of images (the
files of the images stay in the volume).

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_content",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_by", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
        ),
    )
    op.create_table(
        "site_publications",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "published_by", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("content", postgresql.JSONB(), nullable=False),
    )
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("width", sa.SmallInteger(), nullable=False),
        sa.Column("height", sa.SmallInteger(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "created_by", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
        ),
    )
    op.create_index("uq_media_assets_sha256", "media_assets", ["sha256"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_media_assets_sha256", table_name="media_assets")
    op.drop_table("media_assets")
    op.drop_table("site_publications")
    op.drop_table("site_content")
