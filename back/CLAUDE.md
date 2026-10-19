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
- Tests need a real **local** Postgres with a superuser (the schema uses arrays; the bootstrap tests create and drop the scratch database `kidsup_bootstrap_test` and the `kidsup_*_test` roles) and use `kidsup_test`; override with `KIDSUP_TEST_DATABASE_URL`, which must name a local database ending in `_test` (the suite refuses anything else). Never test against SQLite. `tests/test_compose.py` and `tests/test_container.py` also read `../docker-compose.yml` and `../db/Dockerfile`.
- Dependencies: edit `requirements.in` / `requirements-dev.in`, then regenerate the locks with
  `uv pip compile … --universal --generate-hashes` (exact commands in `docs/coding-standards.md` §8). Never hand-edit a lock.
- New migration after a model change: `alembic revision -m "what changed"`, then edit by hand and review (`docs/api-and-database-standards.md` §4).
- Docker: `docker compose up --build` from the repo root. A one-off `bootstrap` job (`python -m app.bootstrap`) creates the four database accounts (superuser, owner, API, retention), runs `alembic upgrade head` as the schema owner and grants the API and retention accounts exactly their rights, then `back` starts. The API never migrates and refuses to start with a wider account than INSERT-only. See `../docs/docker.md`.
- Operator commands, inside the **retention** container (its account may delete; the API's may not): `docker compose exec retention python -m app.cli purge-expired [--dry-run] [--force] | mark-enrolled <id> | erase-application <id> | erase-by-phone` (the purge stops by itself at more than 50 applications due, see `../docs/docker.md`). They log counts, application ids and dates, never names or phone numbers.

## Layout (request flows router → service → database, each layer hands the rest on)

- `app/main.py`: `create_app(config)`: wiring only (middleware, routers, docs on/off). No business logic.
- `app/config.py`: `Settings` from `KIDSUP_*` env vars (see `.env.example`); accepts `postgres://` URLs; refuses wildcard hosts/origins in production.
- `app/middleware.py`: security headers, body-size limit. `app/rate_limit.py`: per-client limiter (`enforce_rate_limit` dependency).
- `app/db.py`: engine (parameters hidden from error text), session, `Base`. `app/models.py`: tables and `ApplicationStatus`. `app/privileges.py`: the start-up check that the API's database account can insert into the application tables and do nothing else (no right on any table, no role membership, no creating).
- `app/bootstrap.py`: the one-off job that sets up the four database accounts, migrates and grants (`SEC-B-07`); it talks to the database itself, the one exception to "only services touch the database" (it creates the accounts the services run as). `app/cli.py` + `app/services/retention.py`: retention and erasure (`SEC-B-09`). `app/logging_config.py`: the log format of the commands.
- `app/routers/`: HTTP only. `app/schemas/`: `…Create` / `…Created` models and validation. `app/services/`: logic.
- `alembic/versions/`: migrations. `tests/`: pytest, mirrors topics of `app/`.

## API (the contract; `front/` reads it from here)

- `GET /health`: unauthenticated, no DB access (deploy checks), reveals nothing.
- `POST /api/applications` → `201 {"id": "<uuid>"}`, `422` validation details, `413`/`411` body too large/missing length, `429` rate limit (`Retry-After: 60`). Body:
  - `parent_name` (required, trimmed, ≤120; control characters and text-direction overrides refused, runs of whitespace become one space), `phone` (≤32, 9–12 plain ASCII digits, only digits/space/+/()/-; any whitespace such as a no-break space becomes one space)
  - `children`: 1–2 of `{ name (≤120, same rules as the parent's), birth_date }`; birth date must be within 2010-01-01..2020-12-31
  - `languages`: 1 to 3 of `Azərbaycan`, `Rus`, `İngilis` (at most 3 are accepted before duplicates are dropped)
  - `consent`: must be the JSON value `true` (not `1`, not `"true"`, not missing): the parent's explicit yes (`SEC-F-16`)
  - `privacy_notice_version`: the version of the notice the parent saw: `YYYY-MM-DD` with an optional suffix `-[a-z0-9]{1,16}` (`2026-10-19-draft`), ≤32, and **one of `PUBLISHED_NOTICE_VERSIONS`** in `app/schemas/application.py` (a consent is stored only against wording that was really shown). A new version is added there in the same change that edits `front/src/content/privacyNotice.ts`, and the API is deployed first.
  The 8–13 age rule is deliberately **not** enforced: the design only warns the parent (age is measured on
  the program start date, 2026-12-05). Admin staff can filter by age later.
- Public by design (listed here per `SEC-B-04`): `/health` (inside the network only: nginx passes on nothing but `POST /api/applications`) and `POST /api/applications`. Everything else added later is authenticated, default deny. A trailing slash (`/api/applications/`) is a plain 404.
- Limits: `KIDSUP_MAX_BODY_BYTES` (16 KiB), `KIDSUP_RATE_LIMIT_PER_MINUTE` (10 per client, per instance).
- Stored in `applications` (+ `application_children`), `status` starts as `new` (only `new` and `enrolled` exist: database CHECK). `consent_given_at` (the database's clock) and `privacy_notice_version` are stored with it; both are empty only for rows from before 2026-10-18. The API's account can only INSERT: it cannot read any of it back.
- Applications that never led to enrolment (`status` `new`) are deleted after `KIDSUP_RETENTION_DAYS` (default and maximum 365: the notice promises 12 months) by the daily `retention` job; a family marked with `mark-enrolled` is kept. A failing run ends the job's container, so it shows up as a restarting container.
- Production (`KIDSUP_ENVIRONMENT=production`): no `/docs`, `/redoc`, `/openapi.json`; HSTS on; explicit `KIDSUP_ALLOWED_HOSTS` / `KIDSUP_CORS_ORIGINS`.

## Not built yet (ask the user first; the security document lists all launch blockers)

- Notifications on new applications (email / WhatsApp / Telegram): channel not chosen.
- Admin API (list/update applications) and authentication: blocked on the admin panel design (`SEC-B-03/04`).
- Bot defence (CAPTCHA) and a shared rate limiter, structured logging with a request id, audit log, a durable register of erasures, a baked `pg_hba.conf`. (Done: retention + erasure, separate DB accounts, `SECURITY.md`.)

## Rules (the short list; the documents above are authoritative)

- Security first (`docs/security-standards.md`). Every control touched has a test that fails if the control is removed.
- Layering: `routers → services → models`; routers hold no queries; services import no `fastapi`.
- No string-built SQL, no secrets or personal data in code/logs/errors/fixtures, never log phone numbers or children's names.
- Public endpoints are `/api/…`; never `*` for CORS/hosts in production. Schema changes only through Alembic.
