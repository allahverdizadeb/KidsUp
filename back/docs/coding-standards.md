# Backend coding standards

Python 3.13 · FastAPI · SQLAlchemy 2 · Pydantic 2 · PostgreSQL. Read [`security-standards.md`](security-standards.md) first: it wins any conflict.

## 1. Principles

1. **Clarity over cleverness.** Code is read far more often than written. If a reader must pause, rename or simplify.
2. **One reason to change per module.** Each layer (below) does one job and hands the rest on.
3. **Make illegal states unrepresentable.** Encode rules in types and validation, not in comments.
4. **Fail loudly at the boundary, trust inside.** Validate everything that enters (HTTP, env, DB rows you do not own); do not re-validate between internal layers.
5. **No speculative code.** No unused parameters, flags, abstractions or "for later" hooks. Delete dead code; Git remembers it.
6. **Comments explain *why*, never *what*.** A comment that restates the code is noise; a missing reason for a surprising decision is a bug.

## 2. Toolchain (all MUST pass, enforced by [the definition of done](README.md#definition-of-done-every-change))

| Tool | Purpose | Config |
|---|---|---|
| `ruff check` | Lint: pyflakes, pycodestyle, isort, pep8-naming, pyupgrade, bugbear, **bandit (`S`)**, simplify, pytest-style | `pyproject.toml` |
| `ruff format` | The only formatter (110 columns). No manual formatting debates. | `pyproject.toml` |
| `mypy --strict` | Static typing for `app/` and `tests/` (tests may omit annotations) | `pyproject.toml` |
| `bandit` | Security static analysis | `pyproject.toml` |
| `pip-audit` | Known-vulnerability scan of the locked dependencies | CI + before release |
| `pytest --cov` | Tests and the 80% gate | `pytest.ini` |

`# noqa` and `# type: ignore` MUST name the rule and carry a reason on the same line. Blanket ignores are forbidden.

## 3. Project layout and layering

```text
back/
├─ app/
│  ├─ main.py          create_app(): wiring only (middleware, routers). No logic.
│  ├─ config.py        Settings (env → typed). The only place that reads the environment.
│  ├─ db.py            engine, session factory, Base, get_db dependency
│  ├─ models.py        SQLAlchemy tables (split into models/ when it outgrows one file)
│  ├─ privileges.py    start-up check that the API's database account can only insert
│  ├─ bootstrap.py     one-off job: database accounts, migrations, grants (talks to the database itself, see below)
│  ├─ cli.py           operator commands (retention, erasure)
│  ├─ logging_config.py  log format of bootstrap and the operator commands
│  ├─ middleware.py    cross-cutting ASGI behaviour (headers, body limits)
│  ├─ rate_limit.py    abuse protection
│  ├─ routers/         HTTP only: parse, call a service, shape the response
│  ├─ schemas/         Pydantic request/response models and their validation
│  └─ services/        business logic (applications, retention); the only layer the API's requests use to talk to the database
├─ alembic/            migrations
├─ tests/              mirrors app/ (see testing-standards.md)
└─ docs/ .claude/
```

**Dependency direction is one-way:** `routers → services → models/db`, and `schemas` is used by routers and services.
`bootstrap.py` is the one exception: it runs before the API exists, creates the accounts the services run as, and so has to talk to PostgreSQL directly (with `psycopg.sql` composition, never string-built SQL). A lower layer MUST NOT import a higher one. Routers MUST NOT touch the session or build queries; services MUST NOT
import `fastapi` (no `Request`, `HTTPException`); models MUST NOT be returned to clients, always map to a schema.

## 4. Naming

Names describe **what a thing is or does in the domain**, in full words. No abbreviations except universally known
ones (`id`, `url`, `db`, `http`, `api`). No `data`, `info`, `manager`, `helper`, `util`, `tmp`, `obj`.

| Thing | Convention | Good | Bad |
|---|---|---|---|
| Module / package | `snake_case`, noun | `rate_limit.py`, `applications.py` | `RateLimitUtils.py`, `helpers.py` |
| Class | `PascalCase`, singular noun | `Application`, `RateLimiter` | `applications`, `AppMgr` |
| ORM model | singular entity | `Application`, `Child` | `ApplicationModel`, `Applications` |
| Request schema | `<Entity>Create` / `<Entity>Update` | `ApplicationCreate` | `ApplicationIn`, `CreateApplicationRequestDTO` |
| Response schema | `<Entity>Read` (full), `<Entity>Created` (ack), `<Entity>Summary` (list item) | `ApplicationCreated` | `ApplicationOut` |
| Function | `snake_case`, **verb phrase** saying what it does | `create_application`, `enforce_rate_limit` | `application`, `do_stuff`, `handle` |
| Predicate | `is_` / `has_` / `can_` / `should_` | `is_production`, `has_expired` | `production`, `check_expiry` |
| Variable | `snake_case`, noun; collections plural | `children`, `recent_hits` | `lst`, `x`, `child_list` |
| Constant | `UPPER_SNAKE_CASE`, module level | `WINDOW_SECONDS`, `BODY_METHODS` | `windowSeconds` |
| Private | single leading `_` | `_forget_idle` | `__forget_idle` (no name mangling) |
| Type alias | `PascalCase` | `Language`, `Name` | `language_t` |
| Type variable | `T`, or descriptive `ModelT` | `ModelT` | `Type1` |
| Test function | `test_<behaviour in plain words>` | `test_rejects_unknown_host` | `test_1`, `test_host` |
| Fixture | noun describing what you get | `client`, `app` | `get_client`, `setup` |
| Env variable | `KIDSUP_` + `UPPER_SNAKE` | `KIDSUP_DATABASE_URL` | `DB`, `DATABASE` |
| URL path | `/api/<plural-noun>`, `kebab-case` | `/api/applications` | `/api/getApplications` |
| JSON field | `snake_case` | `parent_name`, `birth_date` | `parentName` |
| Table / column | plural `snake_case` table, singular `snake_case` column | `application_children.birth_date` | `ApplicationChild`, `birthDate` |
| Foreign key column | `<entity>_id` | `application_id` | `app`, `fk_application` |
| Index / constraint | `ix_<table>_<columns>`, `uq_…`, `ck_…`, `fk_…` | `ix_application_children_application_id` | `idx1` |
| Migration file | `NNNN_<verb>_<what>.py` | `0002_add_application_status.py` | `migration2.py` |
| Git branch | `<type>/<short-kebab>` | `feat/admin-login` | `my-branch` |
| Commit message | Conventional Commits, imperative | `feat(applications): reject duplicate phone within 1h` | `fixed stuff` |

A name that needs a comment to explain it is the wrong name.

## 5. Typing and Python style

- Every function and method MUST have full type annotations (parameters and return). `app/` is checked with `mypy --strict`.
- Use modern syntax: `list[str]`, `X | None`, `type` aliases, `match` where it reads better, f-strings, `pathlib`, `enum.StrEnum`.
- `Any` is forbidden in `app/`. Use a precise type, a `Protocol`, or `object` plus narrowing.
- No mutable default arguments. No wildcard imports. Absolute imports only (`from app.models import Application`).
- Prefer immutability and small pure functions. Use `dataclass(frozen=True, slots=True)` or Pydantic for value objects, never bare dicts that cross a function boundary.
- Functions SHOULD stay under ~30 lines and ≤ 4 parameters; more means a missing abstraction. Cyclomatic complexity stays low enough to read without scrolling.
- `async def` is used only when the body awaits. Blocking calls (the sync SQLAlchemy session, `time.sleep`) MUST NOT run inside `async def` endpoints. Plain `def` endpoints run in the threadpool.
- Configuration comes from `Settings` only. `os.environ` is never read in `app/` outside `config.py` (test setup may set it).
- Time is injected (see `RateLimiter(clock=…)`) so it can be tested. Use timezone-aware datetimes (`datetime.now(UTC)`); naive datetimes are forbidden (`ruff DTZ`).

## 6. Error handling

- Services signal business failures with **specific exception classes** (`class DuplicateApplicationError(Exception)`), never by returning `None`/`False` for "it failed" and never with `HTTPException`.
- Exception handlers in `main.py` map domain exceptions to HTTP status codes and a stable body. One mapping place.
- `except:` and `except Exception:` are forbidden except at a process boundary that logs and re-raises or converts. Catch the narrowest type; never swallow (`pass`).
- Validation failures are `422` from Pydantic. Do not hand-roll parallel validation in routers.
- Errors returned to clients MUST NOT contain stack traces, SQL, file paths, library versions or internal identifiers (see `SEC-B-12`).

## 7. Logging

- Use the standard `logging` module with one logger per module: `logger = logging.getLogger(__name__)`. No `print`.
- Levels: `DEBUG` developer detail (off in production) · `INFO` normal business events · `WARNING` handled anomalies (rate limit hit) · `ERROR` an operation failed · `CRITICAL` the service cannot continue.
- Log **events with identifiers**, not data: `logger.info("application created", extra={"application_id": str(id)})`.
- **Never log personal data** (parent or child names, phone numbers, birth dates), secrets, tokens, or full request bodies at any level (`SEC-B-10`).
- Never build a log message from raw user input with `%`/f-string concatenation that could forge log lines; pass values as arguments or fields.

## 8. Dependencies

- Direct dependencies live in `requirements.in` (loose ranges, each justified in review). The **lock files are generated, hash-pinned and committed**:
  ```text
  uv pip compile requirements.in      --universal --generate-hashes --no-header -o requirements.txt
  uv pip compile requirements-dev.in -c requirements.txt --universal --generate-hashes --no-header -o requirements-dev.txt
  ```
- Installs use `pip install --require-hashes -r requirements.txt`. Hand-editing a lock file is forbidden.
- Adding a dependency requires: maintained project, compatible licence, no known advisories (`pip-audit`), and a stated reason. Prefer the standard library.
- Upgrade at least monthly and immediately for security advisories. After any upgrade re-run the definition of done.

## 9. Review checklist

A reviewer (human or the `backend-reviewer` agent) rejects the change if any answer is "no":

- [ ] Does it respect layering and one-way imports?
- [ ] Are all names precise, in full words, and consistent with §4?
- [ ] Are types complete and is `mypy --strict` clean without new ignores?
- [ ] Are errors specific, mapped in one place, and free of internals?
- [ ] No personal data in logs, errors, URLs or test fixtures that look real?
- [ ] Every new branch and every security-relevant path has a test (see [`testing-standards.md`](testing-standards.md))?
- [ ] Does it meet every applicable control in [`security-standards.md`](security-standards.md)?
- [ ] Is there a migration if the schema changed, and is it reversible?
