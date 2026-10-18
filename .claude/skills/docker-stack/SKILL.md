---
name: docker-stack
description: Build, start, check, inspect and reset the KidsUp Docker stack (nginx front, FastAPI back, PostgreSQL db). Use when asked to run the project in Docker, check container health, view logs, back up or reset the database, or verify the production-like security headers.
---

# Docker stack

Reference: `docs/docker.md` and `docker-compose.yml` at the repository root. Only `front` is published (127.0.0.1:8080); `back` and `db` are internal.

## Preconditions

1. `docker --version` and `docker compose version` work. If not, tell the user Docker Desktop (with WSL 2 on Windows) must be installed and the machine restarted; do not pretend it ran.
2. `.env` exists (copy `.env.example`) with a strong `POSTGRES_PASSWORD` (letters and digits, ≥ 24 chars). Never print, log or commit it. If it is missing, create it with a generated password and tell the user where it is.

## Common tasks

| Task | Command (repo root) |
|---|---|
| Build and start | `docker compose up --build -d` |
| Status (expect all `healthy`) | `docker compose ps` |
| Logs | `docker compose logs -f back` (or `front`, `db`) |
| Verify security headers | `cd front; npm run check:headers` |
| Smoke test the form | submit the form at http://localhost:8080, then `docker compose exec db psql -U kidsup -d kidsup -c "select id, created_at, status from applications order by created_at desc limit 3"` |
| Stop (keep data) | `docker compose down` |
| Backup | `docker compose exec -T db pg_dump -U kidsup kidsup > backup.sql` (contains personal data: store encrypted, never commit) |
| **Reset all data (destructive)** | `docker compose down -v`: confirm with the user first |

## Rules

- Never publish `db` or `back` ports, never add `privileged`, host mounts or the Docker socket, never relax `read_only`, `cap_drop` or `no-new-privileges` to "make it work" (`SEC-B-15`). Fix the cause instead.
- Do not paste real personal data into the database when testing; use obviously fake values.
- After changing any Dockerfile, nginx file or compose setting: rebuild, confirm health, and run `npm run check:headers`.
- Report honestly: if a container is unhealthy, show `docker compose logs` for it and diagnose before retrying.
