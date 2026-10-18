---
name: new-migration
description: Create and review an Alembic database migration for the KidsUp backend (PostgreSQL) following the schema, naming and safety rules. Use whenever a model, table, column, index or constraint changes.
---

# Add a migration

Rules: `back/docs/api-and-database-standards.md` §3–4. Schema changes go **only** through Alembic; never `create_all`; never edit a migration that has been applied anywhere shared.

1. **Change the model** in `app/models.py` first (singular entity name, plural `snake_case` table, `<entity>_id` foreign keys, UUID primary key, `timestamptz` with `server_default`).
2. **Create the file:** `cd back; .\.venv\Scripts\alembic revision -m "<verb> <what>"`, then rename it `NNNN_<verb>_<what>.py` (next number, e.g. `0002_add_application_status.py`) and set `revision`/`down_revision` consistently.
3. **Write it by hand** (autogenerate output is a draft at most):
   - Constraints in the database: `NOT NULL`, `ForeignKey(..., ondelete=…)`, `UniqueConstraint`, `CheckConstraint` for ranges and enums.
   - Name indexes/constraints explicitly (`ix_<table>_<cols>`, `uq_…`, `ck_…`). Index every foreign key and every hot filter column.
   - A docstring explaining **why**.
   - A working `downgrade()` unless data would be destroyed; then say so in the docstring and flag it in review.
4. **Be safe on live data:** adding a `NOT NULL` column needs a default or a backfill step; dropping/renaming is done in separate deploys (expand → migrate data → contract); build large indexes `CONCURRENTLY` (outside a transaction).
5. **Personal data:** a new column holding personal data needs a purpose, retention and erasure story (`SEC-B-09`). Prefer not to store it.
6. **Test it:** run `alembic upgrade head` on a scratch database, then `downgrade -1`, then `upgrade head` again; run `python -m pytest` (the suite builds the schema from all migrations, so a broken migration fails everything).
7. Update the model docs/contract in `back/CLAUDE.md` if the stored shape or API changed. Run `verify-backend`.
