# KidsUp: root

KidsUp is a practical entrepreneurship program for children aged 8–13 (the site is in Azerbaijani; training
language options are Azerbaijani, Russian, English). The program starts on 2026-12-05.
This repo has three independent projects. This file only covers what is shared across them.

| Folder   | What it is                                       | Status                                                          |
|----------|--------------------------------------------------|-----------------------------------------------------------------|
| `front/` | Public landing page, React + TypeScript (Vite)   | Ported from the design (deliberate differences: `front/CLAUDE.md`); 177 tests, ~99% coverage |
| `back/`  | REST API, Python + FastAPI + PostgreSQL          | `POST /api/applications` live; 320 tests, 100% coverage  |
| `admin/` | Admin panel                                      | **Blocked: design not ready**                                   |

Each project has `docs/` (standards) and `.claude/` (skills + agents); the repo root has `.claude/` (cross-project
skills + agents), `docs/docker.md`, `SECURITY.md` and `db/` (the database image). Run everything in Docker with `docker compose up --build` (see `docs/docker.md`).

Local dev without Docker: Postgres 17 on `localhost:5432` (user/password `postgres`, databases `kidsup` and `kidsup_test`),
API on :8000, front on :5173 (Vite proxies `/api` to the API). See each project's CLAUDE.md for commands.

## Mandatory standards (binding, read before changing code)

**Security is mandatory and the highest priority on both sides.** The site collects personal data of children and
their parents. Controls are numbered so they can be cited in reviews and tests:

- Backend: [`back/docs/security-standards.md`](back/docs/security-standards.md) (`SEC-B-01…18`)
- Frontend: [`front/docs/security-standards.md`](front/docs/security-standards.md) (`SEC-F-NN`)
- Admin panel (future) adds stricter rules: [`admin/docs/README.md`](admin/docs/README.md)

Rules that follow from it, for every contributor (human or AI):

1. A change that violates a security control **MUST NOT be merged**, however small or urgent. Security overrides speed, style and convenience.
2. Every control touched needs an automated test that fails if the control is removed. Cite `SEC-B-NN` / `SEC-F-NN` in PR descriptions.
3. Never put secrets or real personal data in code, logs, fixtures, URLs, screenshots or chat. Never add a third-party script, font, tracker or frame without an approved entry in the security documents.
4. Never loosen the CSP, CORS, host checks, rate limits, container hardening or coverage thresholds to "make something work".
5. Exceptions need a dated, owned entry in the *Accepted risks* table of the relevant document. Otherwise they are invalid.

**Tests: 80% coverage at project level is a hard gate** for each project (enforced by `back/pytest.ini` and `front/vite.config.ts`;
the test run fails below it). It is a floor: aim ≥ 90% on changed code and 100% on security code. Never lower it or add exclusions to pass.

Coding standards: [`back/docs/`](back/docs/) and [`front/docs/`](front/docs/) (naming, layering, typing, API/database, styling and accessibility, testing).
WCAG 2.2 AA is mandatory on the frontend.

**Definition of done:** the `verify-all` skill (backend: ruff, mypy, bandit, pip-audit, pytest+coverage; frontend: `npm run verify`).
Use the `security-reviewer` and `standards-reviewer` agents before merging.

## Chain of responsibility for CLAUDE.md files

Instructions are a chain. Each CLAUDE.md owns one scope and passes everything else along.

1. Start with the CLAUDE.md of the project you are editing (`front/`, `back/`, `admin/`). It decides first.
2. If it does not cover the question, it defers to this root file. Do not duplicate a rule in two places.
3. If a rule concerns another project (e.g. an API shape needed by `front/`), the owner is that project's
   CLAUDE.md. Read it, change it there, and only reference it from here.
4. When a rule changes, update the single file that owns it, not its copies.

The same chain applies to `.claude/`: project skills/agents (`front/.claude`, `back/.claude`) first, then the root ones.
Ownership: API contract → `back/`. UI, copy, design tokens → `front/`. Admin screens → `admin/`.
Cross-project conventions (language, naming, git, deploy, security baseline) → this file.

## Cross-project conventions

- **User-facing text is Azerbaijani.** Code, identifiers, comments, commits: English. Commits follow Conventional Commits.
- **The API contract is owned by `back/`.** `front/` and `admin/` consume it and never invent fields.
- **No secrets in the repo.** Each project has `.env.example`; real `.env` files are git-ignored.
- **Don't build admin screens** until the user supplies the design. Do not guess the layout.
- Keep each project independently installable, runnable and deployable.

## Source of truth for the landing page

`front/design-source/` holds the original Claude Design export (`KidsUp Landing Page.dc.html`,
`support.js`, `assets/`). It is read-only reference material, not production code. The React port in
`front/src/` matches it except for the deliberate differences listed in `front/CLAUDE.md` (which owns that list); if the design changes, diff against it.

Open owner decisions: use `#D6006E` for small pink text (brand pink fails WCAG AA contrast, see
`front/docs/styling-and-accessibility-standards.md` A11Y-1); notification channel for new applications; a text-based export of
the brochure PDF (it is two images, A11Y-4); **the privacy notice and consent wording, built as a draft: a launch blocker until counsel
approves it** (`SEC-F-16`, the points to confirm are in `front/docs/privacy-notice-review.md`); the owner's signature on the accepted risks in
`back/docs/security-standards.md` section 5 (nine) and `front/docs/security-standards.md` section 5 (one); the contact and response times in `SECURITY.md`.
