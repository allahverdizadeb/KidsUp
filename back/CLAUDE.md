# back: REST API

Scope: data, validation, persistence, auth. Python 3.13 + FastAPI + SQLAlchemy 2 + **PostgreSQL** (decided by the user).
Defers to `../CLAUDE.md` for cross-project conventions (including the mandatory security baseline). This project
**owns the API contract** that `front/` and `admin/` consume.

## Mandatory standards (read before changing code; they are binding)

| Document | Governs |
|---|---|
| [`docs/security-standards.md`](docs/security-standards.md) | **Security is mandatory, highest priority** (`SEC-B-01…18`): validation, injection, auth, secrets, headers, rate limits, privacy of minors, containers |
| [`docs/coding-standards.md`](docs/coding-standards.md) | Layout, layering, **naming**, typing, errors, logging, dependencies |
| [`docs/api-and-database-standards.md`](docs/api-and-database-standards.md) | REST contract rules, schema design, migrations |
| [`docs/testing-standards.md`](docs/testing-standards.md) | Test design and the **80% project-level coverage gate** |

Skills/agents: [`.claude/`](.claude/) (`verify-backend`, `new-endpoint`, `new-migration`, agent `backend-reviewer`).

## Commands

- Setup: `python -m venv .venv`, activate, `pip install --require-hashes -r requirements-dev.txt` (hash-pinned lock)
- Database: local Postgres on `localhost:5432` (user/password `postgres`, db `kidsup`); `alembic upgrade head`
- Run: `uvicorn app.main:app --reload` (http://localhost:8000, docs at `/docs` in development only)
- **Definition of done:** `ruff check .`, `ruff format --check .`, `mypy`, `bandit -q -r app -c pyproject.toml`,
  `pip-audit --require-hashes -r requirements.txt`, `python -m pytest` (tests + **coverage gate 80%**, currently 100%)
- Tests need a real Postgres (the schema uses arrays) and create/use `kidsup_test`; override with `KIDSUP_TEST_DATABASE_URL`. Never test against SQLite.
- Dependencies: edit `requirements.in` / `requirements-dev.in`, then regenerate the locks with
  `uv pip compile … --universal --generate-hashes` (exact commands in `docs/coding-standards.md` §8). Never hand-edit a lock.
- New migration after a model change: `alembic revision -m "what changed"`, then edit by hand and review (`docs/api-and-database-standards.md` §4).
- Docker: `docker compose up --build` from the repo root (non-root, read-only image; runs `alembic upgrade head` on start). See `../docs/docker.md`.

## Layout (request flows router → service → database, each layer hands the rest on)

- `app/main.py`: `create_app(config)`: wiring only (middleware, routers, docs on/off). No business logic.
- `app/config.py`: `Settings` from `KIDSUP_*` env vars (see `.env.example`); accepts `postgres://` URLs; refuses wildcard hosts/origins in production.
- `app/middleware.py`: security headers, body-size limit. `app/rate_limit.py`: per-client limiter (`enforce_rate_limit` dependency).
- `app/db.py`: engine, session, `Base`. `app/models.py`: tables.
- `app/routers/`: HTTP only. `app/schemas/`: `…Create` / `…Created` models and validation. `app/services/`: logic.
- `alembic/versions/`: migrations. `tests/`: pytest, mirrors topics of `app/`.

## API (the contract; `front/` reads it from here)

- `GET /health`: unauthenticated, no DB access (deploy checks), reveals nothing.
- `POST /api/applications` → `201 {"id": "<uuid>"}`, `422` validation details, `413`/`411` body too large/missing length, `429` rate limit (`Retry-After: 60`). Body:
  - `parent_name` (required, trimmed, ≤120), `phone` (≤32, 9–12 digits, only digits/space/+/()/-)
  - `children`: 1–2 of `{ name (≤120), birth_date }`; birth date must be within 2010-01-01..2020-12-31
  - `languages`: 1+ of `Azərbaycan`, `Rus`, `İngilis` (duplicates dropped)
  The 8–13 age rule is deliberately **not** enforced: the design only warns the parent (age is measured on
  the program start date, 2026-12-05). Admin staff can filter by age later.
- Public by design (listed here per `SEC-B-04`): `/health` and `POST /api/applications`. Everything else added later is authenticated, default deny.
- Limits: `KIDSUP_MAX_BODY_BYTES` (16 KiB), `KIDSUP_RATE_LIMIT_PER_MINUTE` (10 per client, per instance).
- Stored in `applications` (+ `application_children`), `status` starts as `new`.
- Production (`KIDSUP_ENVIRONMENT=production`): no `/docs`, `/redoc`, `/openapi.json`; HSTS on; explicit `KIDSUP_ALLOWED_HOSTS` / `KIDSUP_CORS_ORIGINS`.

## Not built yet (ask the user first; the security document lists all launch blockers)

- Notifications on new applications (email / WhatsApp / Telegram): channel not chosen.
- Admin API (list/update applications) and authentication: blocked on the admin panel design (`SEC-B-03/04`).
- Bot defence (CAPTCHA) and a shared rate limiter, retention + erasure job, separate migration/runtime DB roles, audit log, `SECURITY.md`.

## Rules (the short list; the documents above are authoritative)

- Security first (`docs/security-standards.md`). Every control touched has a test that fails if the control is removed.
- Layering: `routers → services → models`; routers hold no queries; services import no `fastapi`.
- No string-built SQL, no secrets or personal data in code/logs/errors/fixtures, never log phone numbers or children's names.
- Public endpoints are `/api/…`; never `*` for CORS/hosts in production. Schema changes only through Alembic.
