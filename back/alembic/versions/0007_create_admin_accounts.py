"""create admin accounts and sessions

Why: admin panel staff sign in with a named account (SEC-B-03). `admin_users` holds the Argon2id hash of
the password, the one-time-code secret (encrypted by the application with a key that is not in the database)
and what slows down guessing. `admin_sessions` holds one row per sign-in; only a hash of the cookie's
value is stored, so a copy of the table cannot be used to sign in.

The roles are the least-privilege ones of SEC-B-04: viewer (read), coordinator (also changes applications) and
admin (everything, also exports and deletes).

Reversible: both tables are dropped (no personal data of families lives here).

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("totp_secret", sa.String(255), nullable=False),
        # The time step of the last one-time code accepted: a code cannot be used twice.
        sa.Column("last_totp_step", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("failed_logins", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "password_changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("role IN ('viewer', 'coordinator', 'admin')", name="ck_admin_users_role_known"),
        sa.CheckConstraint(
            "email = lower(email) AND length(email) > 2", name="ck_admin_users_email_lowercase"
        ),
    )
    op.create_index("uq_admin_users_email", "admin_users", ["email"], unique=True)

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("admin_id", sa.Uuid(), sa.ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("uq_admin_sessions_token_hash", "admin_sessions", ["token_hash"], unique=True)
    op.create_index("ix_admin_sessions_admin_id", "admin_sessions", ["admin_id"])


def downgrade() -> None:
    op.drop_index("ix_admin_sessions_admin_id", table_name="admin_sessions")
    op.drop_index("uq_admin_sessions_token_hash", table_name="admin_sessions")
    op.drop_table("admin_sessions")
    op.drop_index("uq_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")
