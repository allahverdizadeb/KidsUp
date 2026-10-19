# API and database standards

Naming of paths, fields, tables and migrations is in [`coding-standards.md` §4](coding-standards.md#4-naming). Security is in [`security-standards.md`](security-standards.md).

## 1. REST contract

The API contract is owned by `back/`; `front/` and `admin/` consume it and never invent fields.

- **Resources are plural nouns**: `/api/applications`, `/api/applications/{application_id}`. Verbs belong in HTTP methods, not paths.
- **Methods:** `GET` read (safe, idempotent) · `POST` create · `PUT` full replace · `PATCH` partial update · `DELETE` remove. `GET` MUST NOT change state.
- **Status codes** (always the most specific):

  | Code | When |
  |---|---|
  | `200` | Successful read/update with body · `201` created (with the new id) · `204` success, no body |
  | `400` | Malformed request the framework cannot parse |
  | `401` | Not authenticated · `403` authenticated but not allowed · `404` does not exist **or** the caller may not know it exists |
  | `409` | State conflict (duplicate) · `411` / `413` missing / oversized body |
  | `422` | Well-formed JSON that fails validation |
  | `429` | Rate limit hit (with `Retry-After`) · `5xx` only for genuine server faults |

- **Bodies are JSON, `snake_case`.** Dates are ISO 8601 (`2026-12-05`), timestamps are UTC with offset, ids are UUID strings, money is an integer in the smallest unit plus a currency code.
- **Errors** keep FastAPI's shape (`{"detail": …}`); validation errors list `loc` / `msg`. Messages are safe to show and never expose internals.
- **Responses never leak storage details**: no ORM objects, no internal ids, no fields the caller did not need. Public create endpoints return only the new `id`.
- **Collections MUST be paginated** (`limit` ≤ 100, `offset` or cursor) and sorted deterministically. Unbounded lists are forbidden.
- **Requests are bounded**: every string has a `max_length`, every list a `max_length`, every number a range. Request bodies are capped by `KIDSUP_MAX_BODY_BYTES`.
- **Evolution:** adding an optional field is non-breaking. Removing/renaming a field or changing a meaning is breaking and requires a new path prefix (`/api/v2/…`) and a deprecation period. Introduce `/api/v1` as soon as the first non-`front/` consumer exists.
- **Documentation:** the OpenAPI schema is generated from the code; every endpoint has a `response_model`, a `status_code` and accurate tags. Interactive docs are **disabled in production** (`SEC-B-14`).

## 2. Endpoint checklist

A new endpoint is not done until: input schema with limits · output schema · rate limiting decision · authentication/authorisation decision (**default deny**) · service function · tests for success, each validation rule, each failure mapping and authorisation · documentation of the contract in `CLAUDE.md` if it changes the public API.

## 3. Database design (PostgreSQL)

- **Primary keys are UUIDs** (`uuid.uuid4`) so ids are not guessable or enumerable. Timestamps are `timestamptz`, stored UTC, defaulted by the database (`server_default=func.now()`).
- **Constraints live in the database**, not only in Python: `NOT NULL`, foreign keys with explicit `ON DELETE`, `UNIQUE`, and `CHECK` for ranges and enums. The application validates for UX; the database guarantees integrity.
- **Index every foreign key and every column used in `WHERE`/`ORDER BY` of a hot query.** Justify each index; remove unused ones.
- **Personal data of minors is minimised**: store only what the programme needs; prefer a birth *date* only because the age rule needs it; never store free-text fields that invite sensitive data. Retention is defined in [`security-standards.md`](security-standards.md) (`SEC-B-09`).
- **Enumerations** use a short string column with a `CHECK` constraint (or a PostgreSQL enum) and a `StrEnum` in code. Never magic strings spread around.
- **Soft delete is not a default.** Deleting personal data on request MUST really delete it.
- Query rules: **only through SQLAlchemy** (parameterised). `text()` with string formatting is forbidden (`SEC-B-02`). Avoid N+1 (use `selectinload`/`joinedload` deliberately). Never `SELECT *` on wide tables in hot paths.
- **Transactions:** one request = one unit of work, committed by the service that owns the operation. No partial writes: if two tables change, they change in one transaction.
- **Roles:** migrations run with a role that may alter the schema; the running API uses a **separate role that can only `INSERT`** into its tables, and the retention job and operator commands a third one (find, delete, mark enrolled): see `SEC-B-07`. The `postgres` superuser is for local development only.

## 4. Migrations (Alembic)

- Schema changes go **only** through Alembic. `Base.metadata.create_all` is forbidden outside tests of tooling.
- One migration per logical change, named `NNNN_<verb>_<what>.py`, with a docstring saying *why*.
- Create with `alembic revision -m "…"`, then **edit and review by hand**. Autogenerate output is a draft, never the answer.
- A migration MUST be reversible (`downgrade`) unless data would be lost; then it says so in the docstring and is called out in review.
- **Never edit a migration that has been applied anywhere shared.** Add a new one.
- Destructive or long-locking operations (drop column, add `NOT NULL` without default, non-concurrent index on a large table) are done in multiple deploys: expand → migrate data → contract.
- The Docker image does not migrate. The one-off `bootstrap` job (`python -m app.bootstrap`) runs `alembic upgrade head` as the schema-owning role before the API starts, so there is no race between replicas and the API's own account never needs the right to change the schema (`SEC-B-07`).
- A new table is closed to the API and retention accounts until `app/bootstrap.py` grants it explicitly (per table and column, never `ALL TABLES`): add the grant in the same change as the migration.
- A column that a job filters on by value (such as `status`) has a `CHECK` that lists the values; a new value needs a migration and a decision on how long such rows are kept (`SEC-B-09`).
- Every migration is tested: the test suite builds the schema by running all migrations against a real PostgreSQL (`tests/conftest.py`).
