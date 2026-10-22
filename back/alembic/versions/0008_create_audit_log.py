"""create the audit log

Why: everything staff do that touches personal data or the public site is recorded: who, what, when and from
which network (SEC-B-10). The log is append-only. The panel's account can only INSERT and SELECT on it, and
two triggers refuse UPDATE, DELETE and TRUNCATE for every account that could try (the owner included), so
a row can only disappear by dropping the triggers, which takes the schema owner's rights.

`detail` is a small JSON object of ids and states ("from": "new", "to": "approved"). It never holds a name, a
phone number, a note or a search term.

`admin_email` is a copy of the staff member's address at that time, so the history stays readable if the
account changes; there is no foreign key on purpose, an entry outlives the account.

Reversible: dropping the table discards the history, which the docstring of this migration says out loud.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

REFUSE_CHANGES = """
CREATE FUNCTION audit_log_refuse_changes() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'the audit log is append-only' USING ERRCODE = 'KU004';
END
$$
"""


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("admin_id", sa.Uuid(), nullable=True),
        sa.Column("admin_email", sa.String(254), nullable=True),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=True),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("detail", postgresql.JSONB(), nullable=True),
        # The network the request came from, shortened (the last byte of an IPv4 address is dropped).
        sa.Column("network", sa.String(45), nullable=True),
    )
    op.create_index("ix_audit_log_at", "audit_log", ["at"])
    op.execute(REFUSE_CHANGES)
    op.execute(
        "CREATE TRIGGER audit_log_refuse_row_changes BEFORE UPDATE OR DELETE ON audit_log "
        "FOR EACH ROW EXECUTE FUNCTION audit_log_refuse_changes()"
    )
    op.execute(
        "CREATE TRIGGER audit_log_refuse_truncate BEFORE TRUNCATE ON audit_log "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_log_refuse_changes()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER audit_log_refuse_truncate ON audit_log")
    op.execute("DROP TRIGGER audit_log_refuse_row_changes ON audit_log")
    op.execute("DROP FUNCTION audit_log_refuse_changes()")
    op.drop_index("ix_audit_log_at", table_name="audit_log")
    op.drop_table("audit_log")
