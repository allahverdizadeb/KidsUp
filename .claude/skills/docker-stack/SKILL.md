---
name: docker-stack
description: Build, start, check, inspect and reset the KidsUp Docker stack (nginx front, FastAPI back, PostgreSQL db, bootstrap and retention jobs). Use when asked to run the project in Docker, check container health, view logs, back up or reset the database, erase a family's data, or verify the production-like security headers.
---

# Docker stack

Reference: `docs/docker.md` and `docker-compose.yml` at the repository root. Only `front` is published (127.0.0.1:8080); `back`, `db` and the jobs are internal.

## Preconditions

1. `docker --version` and `docker compose version` work, and the Docker daemon is running (Docker Desktop must be started by hand on Windows). If not, tell the user; do not pretend it ran.
2. `.env` exists (copy `.env.example`) with four **different** strong passwords: `POSTGRES_PASSWORD`, `POSTGRES_OWNER_PASSWORD`, `POSTGRES_APP_PASSWORD`, `POSTGRES_RETENTION_PASSWORD` (letters and digits, ≥ 24 chars: `bootstrap` refuses shorter or repeated ones). Never print, log or commit them. If `.env` is missing, create it with generated passwords and tell the user where it is. The project sits in a OneDrive-synced folder, so tell the user that `.env` is synchronised to the cloud.

## Common tasks

| Task | Command (repo root) |
|---|---|
| Build and start | `docker compose up --build -d` |
| Status (`db`, `back`, `front` healthy; `bootstrap` `Exited (0)`; `retention` up) | `docker compose ps -a` |
| Logs | `docker compose logs -f back` (or `front`, `db`, `bootstrap`, `retention`) |
| Verify security headers | `cd front; npm run check:headers` |
| Smoke test the form | submit the form at http://localhost:8080 with obviously fake data (a UTF-8 JSON file with `curl --data-binary @file` if scripting; shell quoting breaks `ə`), then erase it by its fake phone number: `printf '<fake number>\n<count>\n' \| docker compose exec -T retention python -m app.cli erase-by-phone` (it lists the matches and asks for their count; the form never shows the application id) |
| Count / delete expired applications now | `docker compose exec retention python -m app.cli purge-expired --dry-run` / `… purge-expired` (the job also runs daily; a failing run ends its container) |
| Stop (keep data) | `docker compose down` |
| Backup | `cmd /c "docker compose exec -T db pg_dump -Fc -U kidsup kidsup > <path outside the repo and outside OneDrive>"` (contains personal data: encrypted drive, never in the repo) |
| **Reset all data (destructive)** | `docker compose down -v`: confirm with the user first |

## Rules

- Never publish `db` or `back` ports, never add `privileged`, host mounts or the Docker socket, never relax `read_only`, `cap_drop`, `no-new-privileges` or the `internal` networks to "make it work" (`SEC-B-15`). Fix the cause instead.
- The API gets only the `kidsup_app` account (it can insert and nothing else, and refuses to start with more), the retention job and the operator's commands only `kidsup_retention`. The superuser, owner and retention URLs of `bootstrap` belong to `bootstrap` alone (`back/tests/test_compose.py` checks it). Operator commands run in the `retention` container, not in `back`.
- Never use `docker compose down -v`, `DROP`, `TRUNCATE` or delete rows you did not create without the user's explicit yes: the volume may hold real applications. Test with obviously fake values and remove only your own rows, by id.
- Do not print names, phone numbers or other personal data you see in the database or in logs.
- After changing any Dockerfile, nginx file or compose setting: rebuild, confirm health, and run `npm run check:headers`.
- Report honestly: if a container is unhealthy, show `docker compose logs` for it and diagnose before retrying.
