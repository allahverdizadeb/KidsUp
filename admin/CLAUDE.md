# admin: admin panel

Scope: internal screens for managing KidsUp (most likely application intake from the landing form).
Defers to `../CLAUDE.md` for conventions (including the mandatory security baseline) and to `../back/CLAUDE.md` for the API it consumes.

## Status: blocked, waiting for design

The design is **not ready**. The user will provide it. Until then:

- Do not scaffold a framework, pick a UI kit, or invent screens.
- Do not add endpoints to `back/` just for the admin panel without asking.

## Standards that already apply

Everything in `../front/docs/` (coding, accessibility, testing with the 80% gate, security) plus the stricter **mandatory** admin security rules in
[`docs/README.md`](docs/README.md): authenticated-only, MFA, short sessions, least-privilege roles, audit log of every access to personal data,
no third-party resources, external penetration test before go-live. The backend side is `../back/docs/security-standards.md` (`SEC-B-03/04/09/10`).

## When the design arrives

1. Read it fully, then agree the stack with the user. React + TypeScript to match `front/` is the default.
2. List the admin-only API endpoints needed and add them to `back/` (the contract owner). Authentication and authorisation are built there first.
3. Admin routes are never public. Create `.claude/`, `Dockerfile`, nginx config (baseline: `../front/nginx`) and project docs.
4. Replace this "blocked" section with real commands and layout.
