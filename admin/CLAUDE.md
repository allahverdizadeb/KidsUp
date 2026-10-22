# admin: admin panel

Scope: the screens staff use to run KidsUp: applications (search, filter, status, notes, export), courses, the dashboard and the
landing page's texts and pictures. Defers to `../CLAUDE.md` for conventions (including the mandatory security baseline) and to
`../back/CLAUDE.md` for the API it consumes (`/api/admin/...`, the contract owner).

## Status: the API and the origin are live; the screens are blocked, waiting for design

What exists:

| Part | Where | State |
|---|---|---|
| The panel API (sign-in with MFA, applications, courses, dashboard, content, pictures, audit log) | `../back/app/panel/` | live, tested (`../back/docs/`), runs in its own container `panel` |
| The admin origin: nginx with the admin security headers in front of the panel API | `Dockerfile`, `nginx/` | live: `docker compose up` serves it on `http://127.0.0.1:8081` |
| A live check of that origin's headers and of "nothing without a session" | `scripts/check-security-headers.mjs` | `node admin/scripts/check-security-headers.mjs` |
| The screens (React) | `src/` | **not started: the design has not been delivered** |

Until the design arrives, `public/index.html` is a plain notice page, not a screen.

The design is the Claude Design project's `KidsUp Admin Panel v2.dc.html` (with `support.js`). The Claude Design connector could not
be reached from the build session (it needs `/design-login` in an interactive session), so the file never reached the repo. Export
it to `admin/design-source/` (read-only reference, like `../front/design-source/`) and say so; then do the steps below.

- Do not scaffold a framework, pick a UI kit, or invent screens before that.
- Do not add endpoints to `back/` for a screen without asking: the contract exists, read it first (`../back/CLAUDE.md`).

## Standards that already apply

Everything in `../front/docs/` (coding, accessibility, testing with the 80% gate, security) plus the stricter **mandatory** admin security rules in
[`docs/README.md`](docs/README.md): authenticated-only, MFA, short sessions, least-privilege roles, audit log of every access to personal data,
no personal data in URLs, no third-party resources, external penetration test before go-live. The backend side is `../back/docs/security-standards.md`
(`SEC-B-03/04/09/10`).

## When the design arrives

1. Read it fully, then agree the stack with the user. React + TypeScript + Vite to match `front/` is the default.
2. Build the screens against the API that exists. Sign-in sends the e-mail, password and one-time code to `POST /api/admin/sessions`; every
   request that changes something sends the CSRF token from the answer in `X-CSRF-Token`; the session lasts 15 idle minutes (`X-Background: poll`
   marks a request that must not extend it). Searches are `POST` bodies, never query strings.
3. Put the build in front of the `Dockerfile` here (a build stage, as in `../front/Dockerfile`) and replace `public/`. Keep every header in `nginx/`.
4. Create `.claude/`, `package.json`, tests (80% gate) and project docs; replace this "blocked" section with real commands and layout.
5. Move `../back/tests/test_admin_nginx.py` into this project's own tests once it has tooling.
