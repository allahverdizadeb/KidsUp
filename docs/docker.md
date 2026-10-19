# Running KidsUp with Docker

`docker-compose.yml` runs the production-like stack: **nginx (front) → API (back) → PostgreSQL (db)**, plus two helpers.

```text
 browser ──► front  :8080  nginx + static React build, security headers, rate limit; passes on POST /api/applications only   (published on 127.0.0.1 only)
               │  network `app`  (internal, fixed range: nginx and the API only)
               ▼
             back   :8000  FastAPI. Connects as `kidsup_app`: it can INSERT an application and nothing else                  (no published port, no route out)
               │  network `data` (internal)
               ▼
              db    :5432  PostgreSQL 17, data in the `db-data` volume                                                      (no published port)

 bootstrap  one-off, runs before back: creates the accounts, runs the migrations, sets the grants, exits
 retention  once a day: deletes applications that never led to enrolment after RETENTION_DAYS (365). Also where the operator's
            commands run, as `kidsup_retention` (find, delete, mark enrolled): the API's account cannot do any of that
```

Only `front` is reachable from outside, and by default only on `127.0.0.1`. The API cannot reach the internet (its networks are
`internal`) and the database can only be reached from the API and the two helpers.

## Prerequisites

- Docker Desktop (Windows 11 needs WSL 2: `wsl --install`, then restart) or Docker Engine + the Compose plugin.
- Verify: `docker --version` and `docker compose version`.

## First run

```powershell
Copy-Item .env.example .env          # then edit .env: set the four passwords, all different
python -c "import secrets; print(secrets.token_hex(24))"   # a good password (letters+digits only: it goes into a URL)
docker compose up --build            # add -d to run in the background
```

`.env` is git-ignored, **but this folder is synced to OneDrive, so `.env` is copied to the cloud with it.** That is acceptable for a throw-away
development stack; keep real (production) secrets in a folder that does not sync, or in the hosting platform's secret store.

Open http://localhost:8080. `docker compose ps -a`: `db`, `back`, `front` are `healthy`, `bootstrap` has `Exited (0)` (that is correct) and
`retention` is `Up`.

Verify the security posture of the running stack (every check must pass; it also covers the brochure and certificate being served complete,
that nginx passes on only `POST /api/applications`, and that every nginx answer, its own errors included, carries exactly the documented
security headers once):

```powershell
cd front; npm run check:headers      # defaults to http://localhost:8080
```

## Everyday commands

| Task | Command |
|---|---|
| Start / stop (keep data) | `docker compose up -d` / `docker compose down` |
| Logs | `docker compose logs -f back` (or `front`, `db`, `bootstrap`, `retention`) |
| Rebuild after code changes | `docker compose up --build -d` |
| Count what the purge would delete / delete it (also runs daily by itself) | `docker compose exec retention python -m app.cli purge-expired --dry-run` / `… purge-expired` |
| Keep an enrolled family's application out of the purge | `docker compose exec retention python -m app.cli mark-enrolled <id>` |
| **Erase one family's data on request** (`SEC-B-09`) | `docker compose exec retention python -m app.cli erase-by-phone`: it asks for the number (so it stays out of the shell history), lists the matches (ids and dates, no names) and deletes only after you type back how many there are. Or `… erase-application <id>`. Write the request down in your own register: the system keeps none (`back/docs/security-standards.md` §5, entry 6) |
| Look at the data, e.g. to contact a family (superuser: **there is no named account and no audit trail**, so do not copy what you see anywhere; write down who looked and why; accepted risk §7) | `docker compose exec db psql -U kidsup -d kidsup` |
| Rotate a password | see "Rotating a password" below |
| **Delete all data** (destructive) | `docker compose down -v` |

The operator commands run in the `retention` container, not in `back`: only its account may read what they match on and delete.

The daily purge deletes at most 50 applications by itself. If more are due (a wrong clock on the host would cause that), it deletes nothing and ends its container, which then shows as restarting. Check the host's clock and `docker compose run --rm retention python -m app.cli purge-expired --dry-run`; if the number is right, delete with `docker compose run --rm retention python -m app.cli purge-expired --force`.

**Backups** contain personal data of children. Write them outside the repository **and outside OneDrive** (this folder syncs to the cloud),
to an encrypted drive, and test a restore before relying on them. `*.sql` and `*.dump` are git-ignored, but that does not stop a cloud sync:

```powershell
cmd /c "docker compose exec -T db pg_dump -Fc -U kidsup kidsup > D:\secure\kidsup-2026-10-18.dump"
```

After a parent's deletion request, the deleted data stays in older backups until they expire: delete those backups at the next rotation (30 days at most).

## Database accounts (`SEC-B-07`)

| Account | Who uses it | Rights |
|---|---|---|
| `kidsup` (PostgreSQL superuser) | the one-off `bootstrap` job; an operator for maintenance. No long-running service | everything |
| `kidsup_owner` | `bootstrap`, to run the Alembic migrations | owns the tables; not a superuser |
| `kidsup_app` | `back` only | `INSERT` into the two application tables. It cannot read any column back (not even a count), change a row or delete one, and has no access to `alembic_version`. The API refuses to start in production if it finds more than this: any right on any table, membership of another role, the right to create anything, or no `INSERT` |
| `kidsup_retention` | `retention` and the operator's commands | read `id`, `created_at`, `status` and `phone` of applications; `DELETE` them (the children go with them through the foreign key); set `status`. It cannot read names or birth dates |

`bootstrap` is safe to run on every start. It also upgrades a database created before the split (the tables change owner, earlier wider grants are
withdrawn, no row is touched). It refuses an unsafe setup before it connects: a system database, `postgres` or `pg_*` as a role name, roles or
passwords that repeat, passwords under 24 characters, URLs for different servers or databases, or a database that already holds tables that are not
KidsUp's. A table added later (the admin panel's users, say) is closed to the API and retention accounts until `app/bootstrap.py` grants it.
`back/tests/test_bootstrap.py` proves every refusal against a real PostgreSQL, `back/tests/test_privileges.py` the API's start-up check, and
`back/tests/test_compose.py` that the API never receives another account's password.

### Rotating a password

- **Owner, API or retention account:** edit it in `.env`, then `docker compose up -d`. `bootstrap` sets the account to the new password, and `back` and
  `retention` restart with it, which also drops their open connections.
- **The superuser `kidsup`:** the value in `.env` is applied only when the database is first created, so changing `.env` alone does **not** change it,
  and `bootstrap` would then fail to log in and `back` and `retention` would not start. Order matters:
  1. `docker compose exec db psql -U kidsup -d kidsup`, then `\password kidsup` (type the new password twice: it is hashed on your machine, so it
     never appears in a statement or in a log);
  2. put the same value into `POSTGRES_PASSWORD` in `.env`;
  3. `docker compose up -d`.
- After a suspected leak: rotate all four, then `docker compose restart back retention` so that no old connection survives. Export the logs you may
  need as evidence **first** (`docker compose logs --no-log-prefix back > <path outside the repo and OneDrive>`): they rotate by size.

## What is logged (`SEC-B-10`)

- The API's access log is off (`--no-access-log`): it would record every visitor's IP address. A rate-limit hit is logged as an event without the address.
- A database error carries no bound parameters (names and phone numbers) in its text, and PostgreSQL itself prints neither the failing row nor any
  statement or bound value (`log_error_verbosity=terse`, `log_min_error_statement=panic`, `log_statement=none`, `log_min_duration_statement=-1`,
  `log_parameter_max_length=0`, `log_parameter_max_length_on_error=0`). The operator commands log counts, ids and dates only.
- nginx's access log keeps the address **shortened** (IPv4: last number zeroed) and the path **without its query string**. nginx's error log (which always
  records the full address) is limited to critical failures; refused or failed requests still show up in the access log as 413/429/502/504.
- Docker rotates every service's log by **size** (10 MB × 3), not by age, so how long a line survives depends on traffic. Nothing in them is personal data.
- A hosting provider or TLS proxy in front may keep its own logs: configure it the same way (see `front/docs/privacy-notice-review.md`, row 8).

## What is hardened (and why)

| Measure | Where | Standard |
|---|---|---|
| All five containers: **non-root** (`db` uid 70, `back` 10001, `front` 101), **read-only root filesystem**, `cap_drop: ALL`, `no-new-privileges`, PID and memory limits | `docker-compose.yml`, Dockerfiles | `SEC-B-15`, `SEC-F-12` |
| No host mounts, no Docker socket, no `env_file`, no extra capabilities (checked by test) | `docker-compose.yml` (the only mount is the named `db-data` volume) | `SEC-B-15` |
| API and DB **not published**; the API and the jobs have **no route out** (networks `app` and `data` are `internal`) | `docker-compose.yml` | `SEC-B-07`, `SEC-B-15`, `SEC-B-18` |
| `X-Forwarded-For` is believed only from the private nginx↔API range (never `*`); uvicorn's behaviour with that range is tested | `docker-compose.yml` (`APP_SUBNET`), `back/Dockerfile` (no shell, uvicorn reads `FORWARDED_ALLOW_IPS`) | `SEC-B-15` |
| Four separate accounts; the API's can only insert, and the API checks that at start-up | `back/app/bootstrap.py`, `back/app/privileges.py` | `SEC-B-07` |
| Passwords reach PostgreSQL as SCRAM verifiers, never in clear; the superuser's is never given to the API or the jobs | `back/app/bootstrap.py`, `docker-compose.yml` | `SEC-B-05` |
| Hash-pinned Python dependencies (`--require-hashes`), `npm ci` with lockfile; `pip` removed from the API image; the unused `gosu` removed from the database image | Dockerfiles | `SEC-B-13`, `SEC-F-04` |
| Strict CSP + Trusted Types, HSTS, `nosniff`, frame/CORP/COOP/COEP headers on **every** nginx answer, errors included (the API's JSON gets its own strict CSP) | `front/nginx/` | `SEC-F-02`, `SEC-F-11` |
| nginx passes on `POST /api/applications` and nothing else, looks the API up by name again as its address changes, and ignores the API's `X-Accel-*` headers | `front/nginx/default.conf` | `SEC-F-11` |
| nginx rate limit + body cap (other methods are refused with 405 before the limiter, so they do not use up a visitor's budget); API rate limit + body cap + host allow-list; a trailing slash is a 404, not a redirect to an internal name | `front/nginx/default.conf`, `back/app` | `SEC-B-08`, `SEC-B-11` |
| Production mode (also the default of the API image): no `/docs`, HSTS, wildcards and the `postgres` superuser refused | `KIDSUP_ENVIRONMENT=production`, `back/Dockerfile` | `SEC-B-14` |
| Secrets only via `.env` (git-ignored); compose refuses an empty password | `.env.example`, `docker-compose.yml` | `SEC-B-05` |
| Retention job (a failing run ends its container instead of passing unnoticed) and erasure commands | `back/app/services/retention.py`, `back/app/cli.py` | `SEC-B-09` |

## Scanning the images

No scanner is installed on the machine; Trivy runs in a container and reads saved image files (no Docker socket needed):

```powershell
docker save kidsup-back:latest -o $env:TEMP\back.tar      # also kidsup-front and kidsup-db
docker run --rm -v $env:TEMP:/in:ro -v kidsup-trivy-cache:/root/.cache aquasec/trivy:latest image --input /in/back.tar --severity HIGH,CRITICAL --scanners vuln,secret
```

Rebuild with `docker compose build --pull` first, so the base images are fresh. Result on 2026-10-19: `front` 0 and `db` 0 HIGH/CRITICAL findings and
no secret in any image; `back` 44 HIGH, all in Debian's `util-linux` family (`mount`, `login`, `bsdutils`, …), none with a fix available (`--ignore-unfixed`
finds 0). See the accepted risk in [`../back/docs/security-standards.md`](../back/docs/security-standards.md) §5. Re-scan after every rebuild.

The OWASP ZAP baseline (passive scan of the running front end) runs in a container on the `edge` network:

```powershell
docker run --rm --network kidsup_edge -v ${PWD}\zap:/zap/wrk:rw ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://front:8080 -r zap-report.html -J zap-report.json -I
```

Result on 2026-10-19: **0 failures**, 65 rules passed, 2 informational warnings that are accepted: *Storable and Cacheable Content* (the build output and images
are meant to be cached; `index.html` is `no-cache`, and none of it is personal data) and *Modern Web Application* (a note that the page is a single-page app).

## Before exposing it to the internet (required)

1. Put a **TLS-terminating reverse proxy** in front (Caddy, Traefik, a cloud load balancer) and set `FRONT_BIND` accordingly. Never publish plain HTTP.
   Then fill in `front/nginx/real-ip.conf` with the proxy's address range, or every visitor looks like one address to the rate limit and the logs (and ten
   junk requests a minute lock every family out), and test it through the proxy.
2. Use a **managed or separately secured PostgreSQL** with TLS (`sslmode=verify-full` in the URLs: `bootstrap` and the API both honour it) and encrypted
   storage and backups. Between the containers the traffic is unencrypted on the host-internal network: that is an accepted risk in
   `back/docs/security-standards.md` §5 and ends with the managed database. **Give the managed database the log settings of the `db` service in
   `docker-compose.yml`** (the six `-c` options): providers log slow queries and statements with their values by default. Then force an error
   (for example submit an application as the API account with a missing column) and read the database log: it must show no row, statement or value.
3. Run `bootstrap` as a job that an operator starts, and take `POSTGRES_PASSWORD` (the superuser) out of the environment of everything that starts by itself.
   Consider a `pg_hba.conf` that lets each role in only from its own container (accepted risk §5, entry 1).
4. Set `KIDSUP_ALLOWED_HOSTS` / `KIDSUP_CORS_ORIGINS` to the real host names; the API refuses wildcards in production.
5. Pin base images by digest and rebuild regularly for patches (`docker compose build --pull`), then scan (above). Block outbound traffic from the `edge`
   network at the host's firewall.
6. Keep `.env` and every backup outside folders that sync to a cloud drive.
7. Complete the "Required before public launch" lists in [`../back/docs/security-standards.md`](../back/docs/security-standards.md) and
   [`../front/docs/security-standards.md`](../front/docs/security-standards.md), and have counsel approve the privacy notice
   ([`../front/docs/privacy-notice-review.md`](../front/docs/privacy-notice-review.md)).

## Without Docker (development)

Native development is documented in [`../back/CLAUDE.md`](../back/CLAUDE.md) and [`../front/CLAUDE.md`](../front/CLAUDE.md):
PostgreSQL on `localhost:5432`, `uvicorn app.main:app --reload` on :8000, `npm run dev` on :5173 (Vite proxies `/api`).

## Status

Built and run on 2026-10-18 and again on 2026-10-19 (Docker Desktop 29.8, Compose 5.5), on a fresh volume **and** on the database created earlier (its tables
changed owner, its row was kept, the API's rights were cut down to INSERT-only): all services start in order, `npm run check:headers` passes (54 checks),
a form submitted in a real browser (browser → nginx → API → PostgreSQL) was stored with its consent record and then erased with the operator command, and
the browser console showed zero CSP/Trusted Types violations. The API was recreated with a new address while nginx kept running and nginx still reached it.

The 2026-10-18 work found and fixed: an unquoted `${FORWARDED_ALLOW_IPS}` that the shell expanded (the API restarted in a loop), a Content Security Policy that
blocked a hot-linked image, nginx's own error answers without security headers, IP addresses in the API's and nginx's logs, and an API that ran as the database
superuser. The 2026-10-19 work (after two independent reviews) found and fixed: SQL parameters (names, phone numbers) in the text of database errors, an API account
that could read and delete everything, a bootstrap that could be pointed at the wrong account or database, an erase-by-phone that missed `050…` for `+994 50…`,
a notice link that opened only once, nginx caching the API's address, and an erase command whose open transaction the database would have killed after a minute.

Still open: CI, base-image digests, the unfixed Debian findings above, and everything under "Before exposing it to the internet".
