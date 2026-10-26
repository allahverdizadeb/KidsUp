# Running KidsUp with Docker

`docker-compose.yml` runs the production-like stack: the public site, **nginx (front) → API (back) → PostgreSQL (db)**, the admin panel,
**nginx (admin) → panel API (panel) → PostgreSQL (db)**, and two helpers.

```text
 visitor ──► front  :8080  nginx + static React build, security headers, rate limit; passes on POST /api/applications only    (published on 127.0.0.1 only)
               │  network `app`  (internal, fixed range: nginx and the API only)        reads the `content` volume (read-only): texts, open courses, pictures
               ▼
             back   :8000  FastAPI. Connects as `kidsup_app`: it can INSERT an application and nothing else                  (no published port, no route out)
               │  network `data` (internal)
               ▼
              db    :5432  PostgreSQL 17, data in the `db-data` volume                                                      (no published port)
               ▲
             panel  :8000  FastAPI, the admin API (/api/admin). Connects as `kidsup_panel`; writes the `content` volume       (no published port, no route out)
               ▲  network `admin_app` (internal, fixed range: the admin nginx and the panel only)
 staff ───► admin  :8081  nginx with the admin security headers: serves the built screens (React), the uploaded pictures at     (published on 127.0.0.1 only)
                           /media/<id>.webp (the `content` volume, read-only) and passes on /api/admin/ to the panel

 bootstrap  one-off, runs before back and panel: creates the accounts, runs the migrations, sets the grants, exits
 retention  once a day: deletes applications that were not approved after RETENTION_DAYS (365). Also where the operator's
            commands for applications run, as `kidsup_retention` (find, delete): the API's account cannot do any of that
```

Only `front` and `admin` are reachable from outside, and by default only on `127.0.0.1`. The API and the panel cannot reach the internet (their
networks are `internal`), the database can only be reached from them and the helpers, and the public nginx shares no network with anything of the
admin panel. **The public site never reads the database and never talks to the panel**: the panel writes `courses.json`, `site.json` and the
pictures into the `content` volume, and `front` serves that volume read-only. If the panel is down the landing page keeps showing what was
last published, and an application still goes through `back`.

## Prerequisites

- Docker Desktop (Windows 11 needs WSL 2: `wsl --install`, then restart) or Docker Engine + the Compose plugin.
- Verify: `docker --version` and `docker compose version`.

## First run

```powershell
Copy-Item .env.example .env          # then edit .env: set the five passwords (all different) and the panel key
python -c "import secrets; print(secrets.token_hex(24))"   # a good password (letters+digits only: it goes into a URL)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # the panel key (PANEL_SECRET_KEY)
docker compose up --build            # add -d to run in the background
```

Then create the first member of staff (there is no sign-up and no default account; it asks for the password twice, never as an argument, and shows a
one-time-code secret once, to scan or type into an authenticator app; the account exists only after you type a code from that app, as the app shows it, with or without the space
in the middle. If the last line says `the code is wrong; nothing was changed`, **no account was made**: delete the entry in the app and run the command again (every run makes a new secret). The usual reasons are
a phone whose time is not set automatically, a secret typed wrongly, or an entry left in the app from an earlier run):

```powershell
docker compose exec panel python -m app.panel.cli create-admin --email <e-mail> --name "<name>" --role admin
```

Roles: `viewer` (reads), `coordinator` (also works on applications), `admin` (also exports, deletes, edits courses and the landing page, reads the audit log).
Other commands: `list-admins`, `reset-password`, `reset-second-factor`, `set-role`, `deactivate`, `activate`, `unlock` (`--help`).

`.env` is git-ignored, **but this folder is synced to OneDrive, so `.env` is copied to the cloud with it.** That is acceptable for a throw-away
development stack; keep real (production) secrets in a folder that does not sync, or in the hosting platform's secret store.

Open http://localhost:8080 (the public site) and http://localhost:8081 (the admin panel: the sign-in page asks for the e-mail, the password and the code from
the authenticator app of the account made above). `docker compose ps -a`: `db`, `back`, `panel`, `front`, `admin` are `healthy`, `bootstrap` has
`Exited (0)` (that is correct) and `retention` is `Up`. The admin image builds the screens itself (a Node stage in `admin/Dockerfile`, `npm ci` from the lockfile); the
only thing the admin origin reads from the `content` volume is `/media/<id>.webp`.

Verify the security posture of the running stack (every check must pass; the first covers the brochure and certificate being served complete,
that nginx passes on only `POST /api/applications`, that the published texts and pictures are served as documented, and that every nginx answer, its
own errors included, carries exactly the documented security headers once; the second that the admin origin gives nothing without a session):

```powershell
cd front; npm run check:headers                              # defaults to http://localhost:8080
node admin/scripts/check-security-headers.mjs                # defaults to http://localhost:8081
```

**One command for everything live** (the admin origin serving its screens from its own origin under the strict policy, a registration from the landing page, it appearing in the panel,
a status change saved in the database, a new course shown on the landing page, the course limit and the course's end date, a text and a picture published (also one section at a time) and the picture shown on
the admin origin, the list of staff, roles, sign-out, and both header checks above). It starts a **throw-away copy of the stack** (project `kidsup_check`, ports 18080 and
18081, its own empty database), runs the checks against it and removes it again, so your real stack and its data are never touched; it creates made-up "TEST" accounts, applications and
courses in the copy only:

```powershell
powershell -File scripts\verify-stack.ps1            # about three minutes; add -Keep to leave the copy running
```

It needs Docker, Node 18+ and the backend's `.venv` (`back/CLAUDE.md`), and it refuses the real project's name. The checks themselves are in `scripts/e2e_check.py`.

## Everyday commands

| Task | Command |
|---|---|
| Start / stop (keep data) | `docker compose up -d` / `docker compose down` |
| Logs | `docker compose logs -f back` (or `panel`, `front`, `admin`, `db`, `bootstrap`, `retention`) |
| Rebuild after code changes | `docker compose up --build -d` |
| Create / change / switch off an admin account | `docker compose exec panel python -m app.panel.cli create-admin --email … --name … --role …` (and `list-admins`, `reset-password`, `reset-second-factor`, `set-role`, `deactivate`, `activate`, `unlock`). There is no sign-up and no web screen for accounts: only whoever can run this command can add staff. Every change is in the audit log |
| Count what the purge would delete / delete it (also runs daily by itself) | `docker compose exec retention python -m app.cli purge-expired --dry-run` / `… purge-expired`. Only applications that were **not approved** are purged; an approved one stays until it is erased on request |
| **Erase one family's data on request** (`SEC-B-09`) | `docker compose exec retention python -m app.cli erase-by-phone`: it asks for the number (so it stays out of the shell history), lists the matches (ids and dates, no names) and deletes only after you type back how many there are. Or `… erase-application <id>`. Write the request down in your own register: the system keeps none (`back/docs/security-standards.md` §5, entry 6) |
| Look at the data, e.g. to contact a family (superuser: **there is no named account and no audit trail**, so do not copy what you see anywhere; write down who looked and why; accepted risk §7) | `docker compose exec db psql -U kidsup -d kidsup` |
| Rotate a password | see "Rotating a password" below |
| **Delete all data** (destructive) | `docker compose down -v` |

The operator commands for applications run in the `retention` container, not in `back`: only its account may read what they match on and delete. Those for
admin accounts run in `panel`, the only container that holds the panel's key. An application is approved, declined or erased in the admin panel, which also
checks that the course has places left; the operator has no command that approves one.

The daily purge deletes at most 50 applications by itself. If more are due (a wrong clock on the host would cause that), it deletes nothing and ends its container, which then shows as restarting. Check the host's clock and `docker compose run --rm retention python -m app.cli purge-expired --dry-run`; if the number is right, delete with `docker compose run --rm retention python -m app.cli purge-expired --force`.

**Backups** contain personal data of children. Write them outside the repository **and outside OneDrive** (this folder syncs to the cloud),
to an encrypted drive, and test a restore before relying on them. `*.sql` and `*.dump` are git-ignored, but that does not stop a cloud sync:

```powershell
cmd /c "docker compose exec -T db pg_dump -Fc -U kidsup kidsup > D:\secure\kidsup-2026-10-18.dump"
```

After a parent's deletion request, the deleted data stays in older backups until they expire: delete those backups at the next rotation (30 days at most).

The `content` volume holds the published texts, the list of open courses and the uploaded pictures. It has **no personal data of applicants**, but a picture
may show people: upload a photo of a child only with the parent's consent, and remove it again (`DELETE /api/admin/media/{id}`, an admin) when consent is
withdrawn. Pictures are cached by browsers for one day only, so a removed picture is gone everywhere the next day. The volume is rebuilt from the database:
`courses.json` and `site.json` are written again at every start and every minute. A new picture is stored in the volume **and** recorded in the database,
so a backup of the database without the volume has the pictures' rows and not their files: the panel then refuses to publish a page that names a missing
file (`missing_image_file`), and uploading the same picture again puts its file back. Back up both, or accept that.

## Database accounts (`SEC-B-07`)

| Account | Who uses it | Rights |
|---|---|---|
| `kidsup` (PostgreSQL superuser) | the one-off `bootstrap` job; an operator for maintenance. No long-running service | everything |
| `kidsup_owner` | `bootstrap`, to run the Alembic migrations | owns the tables; not a superuser |
| `kidsup_app` | `back` only | `INSERT` into the two application tables, on the form's columns only (not the status, the time of a status change or the creation time: a new application is always `new`, at the database's clock). It cannot read any column back (not even a count), change a row or delete one, cannot insert anywhere else, and has no access to `alembic_version`. The API refuses to start in production unless it holds **exactly** this (`APP_GRANTS`): any other right on any table or column, membership of another role, the right to create anything (temporary tables included), or a missing `INSERT` |
| `kidsup_retention` | `retention` and the operator's commands | read `id`, `created_at`, `status` and `phone` of applications; `DELETE` them (the children go with them through the foreign key). It cannot read names or birth dates, and it cannot change a status |
| `kidsup_panel` | `panel` only | what staff work with, granted per table and per column (`back/app/grants.py`): read and change applications' status and notes, read the children, manage courses, the landing page's draft and publications, pictures, admin accounts and sessions, and append to the audit log. It cannot change or delete an audit entry, cannot create, drop or alter anything, and the panel refuses to start in production if it finds more (or fewer) rights than that |

`bootstrap` is safe to run on every start. It also upgrades a database created earlier (the tables change owner, earlier wider grants are
withdrawn, no row is touched; the migrations add the courses, the admin tables and the rules below without losing an application). It refuses an unsafe
setup before it connects: a system database, `postgres` or `pg_*` as a role name, roles or passwords that repeat, passwords under 24 characters, URLs for
different servers or databases, or a database that already holds tables that are not KidsUp's. A table added later is closed to every account until
`app/bootstrap.py` grants it. `back/tests/test_bootstrap.py` proves every refusal against a real PostgreSQL, `back/tests/test_privileges.py` the start-up
checks of the API and of the panel, and `back/tests/test_compose.py` that each container receives only its own account's password.

The **course rules live in the database**, so they hold whoever writes the rows (`back/alembic/versions/0006`): an application goes to the one open course (or
the course it names) and is refused when the course is closed, full or unknown (`KU001`, the API answers 409 "Registration is closed."); approving an
application is refused when its children no longer fit (`KU002`, checked under a row lock, so two staff approving at once cannot overfill a course); a
course's capacity cannot go below the children already approved (`KU003`); the audit log cannot be changed or deleted (`KU004`).

### Rotating a password

- **Owner, API, retention or panel account:** edit it in `.env`, then `docker compose up -d`. `bootstrap` sets the account to the new password, and `back`,
  `panel` and `retention` restart with it, which also drops their open connections.
- **The panel key (`PANEL_SECRET_KEY`):** it encrypts every member of staff's one-time-code secret in the database. Changing it makes all of those secrets
  unreadable, so nobody can sign in until each account has a new authenticator (`reset-second-factor`, one account at a time, from the operator's terminal).
  Until then every attempt looks like a wrong code and counts toward the lock, so if staff suddenly cannot sign in after a key change, that is the cause.
  Rotate it only after a suspected leak, and have the operator ready to reset every account. Losing it has the same effect.
- **The superuser `kidsup`:** the value in `.env` is applied only when the database is first created, so changing `.env` alone does **not** change it,
  and `bootstrap` would then fail to log in and `back` and `retention` would not start. Order matters:
  1. `docker compose exec db psql -U kidsup -d kidsup`, then `\password kidsup` (type the new password twice: it is hashed on your machine, so it
     never appears in a statement or in a log);
  2. put the same value into `POSTGRES_PASSWORD` in `.env`;
  3. `docker compose up -d`.
- After a suspected leak: rotate all five passwords (and the panel key if it may have leaked), then `docker compose restart back panel retention` so that no
  old connection survives; end every staff session (`docker compose exec panel python -m app.panel.cli list-admins`, then `deactivate` / `activate`
  the accounts, which signs them out). Export the logs you may need as evidence **first**
  (`docker compose logs --no-log-prefix back > <path outside the repo and OneDrive>`): they rotate by size. The audit log in the database (who did what, from
  which network) is the other evidence, and it cannot be edited.

## What is logged (`SEC-B-10`)

- The API's access log is off (`--no-access-log`): it would record every visitor's IP address. A rate-limit hit is logged as an event without the address.
- A database error carries no bound parameters (names and phone numbers) in its text, and PostgreSQL itself prints neither the failing row nor any
  statement or bound value (`log_error_verbosity=terse`, `log_min_error_statement=panic`, `log_statement=none`, `log_min_duration_statement=-1`,
  `log_parameter_max_length=0`, `log_parameter_max_length_on_error=0`). The operator commands log counts, ids and dates only.
- nginx's access log keeps the address **shortened** (IPv4: last number zeroed) and the path **without its query string**. nginx's error log (which always
  records the full address) is limited to critical failures; refused or failed requests still show up in the access log as 413/429/502/504. The admin nginx
  logs the same way. The panel has no access log either (`--no-access-log`).
- The **audit log** is the one place that records what staff do: who signed in or failed to (the e-mail only if the account exists), who looked at, changed,
  exported or erased which application, course or text, and the **network** it came from (203.0.113.0/24, never the address). It holds ids and changed
  fields, never a name, a phone number, a note or a search term, and the database refuses to change or delete an entry (`KU004`).
- Docker rotates every service's log by **size** (10 MB × 3), not by age, so how long a line survives depends on traffic. Nothing in them is personal data.
- A hosting provider or TLS proxy in front may keep its own logs: configure it the same way (see `front/docs/privacy-notice-review.md`, row 8).

## What is hardened (and why)

| Measure | Where | Standard |
|---|---|---|
| All seven containers: **non-root** (`db` uid 70, `back` and `panel` 10001, `front` and `admin` 101), **read-only root filesystem**, `cap_drop: ALL`, `no-new-privileges`, PID and memory limits | `docker-compose.yml`, Dockerfiles | `SEC-B-15`, `SEC-F-12` |
| No host mounts, no Docker socket, no `env_file`, no extra capabilities (checked by test); the only mounts are the named volumes `db-data` and `content` (`panel` writes it, `front` reads it with `:ro`, nobody else mounts it) | `docker-compose.yml` | `SEC-B-15` |
| API, panel and DB **not published**; the API, the panel and the jobs have **no route out** (networks `app`, `admin_app`, `data` and `data_panel` are `internal`); the public nginx shares no network with the admin nginx or the panel, and **the public API shares none with the panel** (the panel and the database have their own `data_panel`), so a taken-over API cannot reach the panel's login behind the admin nginx's allow-list | `docker-compose.yml`, `back/tests/test_compose.py` | `SEC-B-07`, `SEC-B-15`, `SEC-B-18` |
| Every container has a CPU limit as well as PID and memory limits; the admin nginx's `/tmp` (where it holds an upload) is a 32 MB tmpfs; both nginx servers cap the requests one address holds open (`limit_conn`), end timed-out connections and use short body and send timeouts | `docker-compose.yml`, `front/nginx`, `admin/nginx` | `SEC-B-08`, `SEC-B-15` |
| The panel's key reaches the panel only; the public and the admin nginx receive no secret at all (checked by test) | `docker-compose.yml` | `SEC-B-05` |
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
docker save kidsup-back:latest -o $env:TEMP\back.tar      # also kidsup-front, kidsup-admin and kidsup-db (the panel runs the kidsup-back image)
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
   and `admin_edge` networks at the host's firewall.
6. Keep `.env` and every backup outside folders that sync to a cloud drive.
7. Complete the "Required before public launch" lists in [`../back/docs/security-standards.md`](../back/docs/security-standards.md) and
   [`../front/docs/security-standards.md`](../front/docs/security-standards.md), and do what the privacy notice's approval leaves to the owner
   ([`../front/docs/privacy-notice-review.md`](../front/docs/privacy-notice-review.md)): the hosting provider and country must be the ones counsel assumed.

### The admin panel, additionally (required)

The admin origin shows families' details to staff. It is not for the internet as it stands:

1. **TLS and a network allow-list in front of it.** Publish it only behind a TLS-terminating proxy, and list the staff's VPN or office addresses in
   `admin/nginx/network-allow-list.conf` (and the proxy's range in `admin/nginx/real-ip.conf`, or the allow-list sees only the proxy). Keep
   `ADMIN_BIND=127.0.0.1` otherwise. The session cookie is `Secure`: browsers send it only over HTTPS (and to `localhost`).
2. **Set `ADMIN_ORIGINS`** to the address staff really use (a JSON list). A request that changes something from any other origin is refused, and so is a
   panel started in production with a wildcard anywhere, or with the developer's defaults for hosts and origins. Serve the admin origin on a name whose
   other sub-domains you control: the session cookie is host-only (`__Secure-`, `Path=/api/admin`), but a hostile sibling sub-domain could still set a cookie
   of the same name and force sign-outs.
3. **Create named accounts only**, with the operator command; no shared login. Give `viewer` to whoever only needs to look, `coordinator` to whoever works
   on applications, and `admin` to as few people as possible (it exports families' details, erases them, takes an approval back, edits the public site and
   its pictures and reads the audit log).
4. **Keep `PANEL_SECRET_KEY` out of folders that sync to a cloud drive** and keep a copy somewhere else; losing it signs everyone out for good until each
   authenticator is set up again.
5. **Run one panel container** (it is one worker on purpose: the sign-in limiter and the refresh of the public files live in the process).
6. **An external penetration test of the admin panel passes before anyone but you uses it** (`admin/docs/README.md`, rule 9; `SEC-F-15`), and the accepted
   risks of the panel in `back/docs/security-standards.md` §5 are signed by the owner.

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

On 2026-10-21 the admin panel was added (seven containers instead of five). Built and run on the **existing database** (migrations 0004 to 0010 ran through `bootstrap`; the one application it
held and its child were kept and linked to the first course, which the migration created from the programme the landing page advertised) and on a **fresh volume**. `scripts/verify-stack.ps1` passed on
a throw-away copy: 62 end-to-end checks, the public headers check (78) and the admin one (50). In a real browser: a published headline and picture appeared on the landing page, a form submission
went to the chosen course, a closed course list showed the closed notice, the layout held at 390 px, the panel's cookie (`Secure`, `HttpOnly`, `SameSite=Strict`) worked over `http://127.0.0.1`
in Chromium and the browser console held no CSP or Trusted Types violation. A database dump taken before the migration is in `%LOCALAPPDATA%\KidsUp-backups` (outside OneDrive; it holds that one application:
delete it when you no longer need it).

On 2026-10-22 four read-only security reviews (sign-in and sessions; applications and database rules; the landing page's content and pictures; nginx and compose) found no critical or high
problem and about thirty medium to low ones; all that were real were fixed, each with a test that fails when its guard is removed (nine of the most important were taken out one at a time to prove it):
validation answers that repeated what was typed, a password-change form that allowed unlimited guessing, a race that let one sign-in code open two sessions, an API account that could insert a
status, a coordinator who could send a family's data to the deletion job, link hosts and phone numbers that were not checked, a publication that the refresh could overwrite, pictures that could not
be removed, slow-connection exhaustion in both nginx servers, and the public API sharing a network with the panel. Migration 0011 and the new network layout were applied to the **real stack without
touching its data** (the one application and its child were kept; a dump taken first is in `%LOCALAPPDATA%\KidsUp-backups`). `scripts/verify-stack.ps1` on a throw-away copy: 77 end-to-end checks (12 of them
prove from inside the containers which can reach which), the public headers check (78) and the admin one (50). The standards reviews (naming, layering, tests) were started and stopped before they
reported, so they are still to do.

On 2026-10-26 the admin **screens** (React, from `KidsUp Admin Panel v2.dc.html`) were built into `admin/` and put on the **real stack without touching its data** (migration 0012 `courses.end_date` ran
through `bootstrap`; the one application, its child and the course were kept, row counts before and after are the same; a dump taken first is in `%LOCALAPPDATA%\KidsUp-backups`). Gates: backend ruff, mypy,
bandit, pip-audit and 1112 tests at 100% coverage; admin `npm run verify` (353 tests, 97.7% statements, audit 0, build); front 379 tests. `scripts/verify-stack.ps1` on a throw-away copy: 103 end-to-end
checks, the public headers check (78) and the admin one (50); the same two header checks on the real stack after the rebuild (78 and 50). In a real browser, on a throw-away copy, at desktop width and at 390 px: sign-in
(the first box with a fault takes the focus), a form submission from the landing page, the application in the panel, approval taking a place (the landing page's file went from 20 to 19 places left),
a new course with 12 places and the single-active-course switch (the landing page then read capacity 12), a published headline on the landing page, the CSV question, sign-out and a 401 from every
endpoint afterwards; the console held no CSP or Trusted Types violation. A panel with a one-minute idle time (throw-away copy only) showed that requests a page makes by itself never keep a session alive and
that a person's, or a change marked as background, always do. Two reviewers (security, standards) went through the screens twice: what did not change the owner's design was fixed; the rest is recorded in `admin/docs/README.md` for the owner
(ADM-2, ADM-8, ADM-9, ADM-10 and the accepted risks AR-1 to AR-4). The last small fixes (the session is touched only after a request passed its checks, `disable_symlinks` on the picture routes, the idle clock counting
clicks and input) were checked by tests and by the live runs above, not by a third review. The real database has **no staff account yet**: make the first with `docker compose exec panel python -m app.panel.cli create-admin ...`.

Still open: CI, base-image digests, the unfixed Debian findings above, the owner's decisions on the admin screens (`admin/docs/README.md` ADM-2, ADM-8, ADM-9), an external penetration test of the admin panel, and everything under "Before exposing it to the internet".
