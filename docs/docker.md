# Running KidsUp with Docker

`docker-compose.yml` runs the production-like stack: **nginx (front) → API (back) → PostgreSQL (db)**.

```text
 browser ──► front  :8080   nginx + static React build, security headers, rate limit, proxies /api/
                │
                ▼  (private network)
              back  :8000   FastAPI, runs `alembic upgrade head` on start      (no published port)
                │
                ▼  (internal network)
               db   :5432   PostgreSQL 17, data in the `db-data` volume         (no published port)
```

Only `front` is reachable from outside, and by default only on `127.0.0.1`. The API and the database have **no published ports**.

## Prerequisites

- Docker Desktop (Windows 11 needs WSL 2: `wsl --install`, then restart) or Docker Engine + the Compose plugin.
- Verify: `docker --version` and `docker compose version`.

## First run

```powershell
Copy-Item .env.example .env          # then edit .env: set POSTGRES_PASSWORD
python -c "import secrets; print(secrets.token_hex(24))"   # a good password (letters+digits only: it goes into a URL)
docker compose up --build            # add -d to run in the background
```

Open http://localhost:8080. Check everything is healthy: `docker compose ps` (all `healthy`).

Verify the security posture of the running stack (every check must pass; it also covers the brochure and certificate being served complete with the security headers):

```powershell
cd front; npm run check:headers      # defaults to http://localhost:8080
```

## Everyday commands

| Task | Command |
|---|---|
| Start / stop (keep data) | `docker compose up -d` / `docker compose down` |
| Logs | `docker compose logs -f back` (or `front`, `db`) |
| Rebuild after code changes | `docker compose up --build -d` |
| Look at applications | `docker compose exec db psql -U kidsup -d kidsup -c "select id, created_at from applications"` |
| **Delete all data** (destructive) | `docker compose down -v` |
| Backup | `docker compose exec -T db pg_dump -U kidsup kidsup > backup.sql` (store it encrypted; it contains personal data) |

## What is hardened (and why)

| Measure | Where | Standard |
|---|---|---|
| `back` and `front` run as **non-root** | `back/Dockerfile` (uid 10001), `nginx-unprivileged` | `SEC-B-15`, `SEC-F-12` |
| **Read-only root filesystem**, `cap_drop: ALL`, `no-new-privileges` | `docker-compose.yml` for `back` and `front`; `db` keeps the stock Postgres image defaults and only has `no-new-privileges` | `SEC-B-15` |
| API and DB **not published**; DB network is `internal` | `docker-compose.yml` | `SEC-B-07`, `SEC-B-15` |
| Hash-pinned Python dependencies (`--require-hashes`), `npm ci` with lockfile | Dockerfiles | `SEC-B-13`, `SEC-F-04` |
| Strict CSP + Trusted Types, HSTS, `nosniff`, frame/CORP/COOP headers | `front/nginx/security-headers.conf` | `SEC-F-02`, `SEC-F-11` |
| nginx rate limit + body cap; API rate limit + body cap + host allow-list | `front/nginx/default.conf`, `back/app` | `SEC-B-08`, `SEC-B-11` |
| Production mode: no `/docs`, HSTS, wildcards refused | `KIDSUP_ENVIRONMENT=production` | `SEC-B-14` |
| Secrets only via `.env` (git-ignored); compose refuses an empty password | `.env.example`, `docker-compose.yml` | `SEC-B-05` |

## Before exposing it to the internet (required)

1. Put a **TLS-terminating reverse proxy** in front (Caddy, Traefik, a cloud load balancer) and set `FRONT_BIND` accordingly. Never publish plain HTTP.
2. Use a **managed or separately secured PostgreSQL** with TLS (`sslmode=verify-full`), encrypted storage and backups, and **two roles**: a migration owner and a runtime role limited to `SELECT/INSERT/UPDATE/DELETE` (`SEC-B-07`). The compose file uses a single owner role for convenience only.
3. Replace `FORWARDED_ALLOW_IPS: "*"` with the proxy's address if the API is ever reachable by anything other than nginx.
4. Set `KIDSUP_ALLOWED_HOSTS` / `KIDSUP_CORS_ORIGINS` to the real host names; the API refuses wildcards in production.
5. Pin base images by digest, scan images (Trivy/Grype), and rebuild regularly for patches.
6. Complete the "Required before public launch" lists in [`../back/docs/security-standards.md`](../back/docs/security-standards.md) and [`../front/docs/security-standards.md`](../front/docs/security-standards.md).
7. With more than one API replica, run `alembic upgrade head` as a one-off job instead of in the container start command.

## Without Docker (development)

Native development is documented in [`../back/CLAUDE.md`](../back/CLAUDE.md) and [`../front/CLAUDE.md`](../front/CLAUDE.md):
PostgreSQL on `localhost:5432`, `uvicorn app.main:app --reload` on :8000, `npm run dev` on :5173 (Vite proxies `/api`).

## Status

The stack was built and run for the first time on 2026-10-18 (Docker Desktop 29.8, Compose 5.5): all three containers `healthy`, `npm run check:headers`
40/40, and a form submitted in a real browser (browser → nginx → API → PostgreSQL) was stored and then deleted, with zero CSP/Trusted Types violations in the console.

That first run found and fixed one bug: an unquoted `${FORWARDED_ALLOW_IPS}` in the start command of `back/Dockerfile` was expanded by the shell (`*` became the
names of the files in the working directory), so uvicorn refused to start and the API restarted in a loop. `back/tests/test_container.py` guards against it.

Still open: scanning the images (Trivy/Grype), the OWASP ZAP baseline and CI (see the "Required before public launch" lists).
