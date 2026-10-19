# Backend security standards

> ## MANDATORY, HIGHEST PRIORITY
>
> Security is a **hard requirement** of this project, not a quality goal. KidsUp stores **personal data of children
> and their parents**. Every control below with **MUST** is mandatory for every change, every environment and every
> contributor, human or AI. A change that violates a control MUST NOT be merged, however small or urgent.
> Security overrides speed, convenience, style and every other document.
>
> The matching frontend rules are in [`../../front/docs/security-standards.md`](../../front/docs/security-standards.md).
> Security is enforced on **both** sides; neither side may assume the other is secure.

Words follow RFC 2119. Controls have stable IDs (`SEC-B-NN`) so reviews, tests and code comments can cite them.
Defence in depth is the rule: each control assumes the layer in front of it has already failed.

## 1. Assets and threat model

| Asset | Sensitivity | Where |
|---|---|---|
| Child name + date of birth | **High** (minor's personal data) | `application_children` |
| Parent name + phone number | **High** (personal data, contact) | `applications` |
| Application records as a whole | High (reveals who has children of what age) | PostgreSQL |
| Database credentials, future signing keys, admin credentials | **Critical** | environment / secret store |
| Availability of the application form | Medium | API + nginx |

Adversaries considered: anonymous internet attackers (injection, abuse, scraping, DoS), spam bots, a compromised
dependency or base image, a misconfigured deployment, a curious or careless insider, and a stolen backup.
Trust boundary: **everything that arrives over HTTP is hostile**, including headers, JSON types, lengths and encodings.

## 2. Controls

### SEC-B-01 Input validation
- Every input MUST be validated by a Pydantic schema before use. Validate by **allow-list** (type, format, range, enum), not by trying to detect bad input.
- Every string MUST have `max_length`; every list `max_length`; every number a range; every enum a closed `Literal`/`StrEnum`.
- Unknown fields are ignored or rejected deliberately; never copied blindly into models (no `**request_dict`).
- Validation messages MUST NOT echo secrets. Path/query parameters are validated like bodies.

### SEC-B-02 Injection prevention
- Database access MUST go through SQLAlchemy constructs or bound parameters. String-built SQL (`f"…{x}"`, `%`, `+`, `.format`) is **forbidden**, including in `text()`. `ruff S608` and `bandit` enforce this.
- No `eval`, `exec`, `pickle`/`marshal`/`yaml.load` on untrusted data, `subprocess(shell=True)`, `os.system`, or template rendering of user input.
- User-controlled values MUST NOT be interpolated into log messages as format strings (log forging) or into HTTP headers (response splitting).

### SEC-B-03 Authentication (required before any non-public endpoint exists)
- Passwords MUST be hashed with **Argon2id** (or bcrypt cost ≥ 12) with a per-user salt. Never a fast hash. Never reversible encryption.
- Admin accounts MUST use **multi-factor authentication**. Sessions/tokens are short-lived (≤ 15 min access), revocable, bound to the user, and rotated on privilege change.
- Tokens are `Authorization` bearer or `HttpOnly; Secure; SameSite=Strict` cookies, never in URLs or `localStorage`. JWTs, if used, pin the algorithm, validate `iss`/`aud`/`exp`, and never accept `alg=none`.
- Login MUST be rate-limited per account **and** per address, with uniform error messages and timing (no user enumeration), and lockout/backoff after repeated failures.

### SEC-B-04 Authorisation
- **Default deny.** An endpoint is public only if it is explicitly marked so and listed in `CLAUDE.md`. All others require an authenticated, authorised principal via a shared dependency.
- Authorise on the **server** for every request and every object (prevent IDOR/BOLA: check that *this* caller may access *this* record, never trust ids in the path).
- Roles are least-privilege (e.g. `viewer`, `coordinator`, `admin`). Role changes and exports are audited (SEC-B-10).

### SEC-B-05 Secrets management
- Secrets (database URL, keys, passwords, tokens) MUST come from the environment or a secret manager through `Settings`. They MUST NOT appear in source, images, logs, error messages, test fixtures, issues or chat.
- `.env` is git-ignored; `.env.example` holds names only. Production secrets are generated (≥ 24 random chars), unique per environment, and rotated on departure or suspicion of leak.
- A secret scanner (e.g. `gitleaks`) MUST run before every merge. A leaked secret is considered compromised and rotated immediately, not just removed from history.

### SEC-B-06 Transport security
- All production traffic MUST use **TLS 1.2+** (1.3 preferred), terminated at a trusted proxy. HTTP redirects to HTTPS; the API sends `Strict-Transport-Security` (done in production mode).
- The database connection in production MUST use TLS with certificate verification (`sslmode=verify-full`) unless the database is reachable only on a private network that is itself encrypted, and that exception is recorded in §5.
- Cookies (when introduced) are `Secure`, `HttpOnly`, `SameSite=Strict`, with the narrowest `Path`/`Domain`.

### SEC-B-07 Database least privilege and hardening
- Every running service MUST use a role with only the rights it needs, on its own tables. The public API's role can **insert** an application and its children and nothing else: it cannot read a single column back (not even a count), change a row or delete one. The retention job and the operator's commands use a separate role (find what to delete, delete it, mark an enrolment). Migrations use a third, schema-owning role. No deployed service uses the superuser, except the one-off `bootstrap` job (§5 entry 1).
- The API MUST refuse to start in production when its database account is a superuser, can create roles or databases, bypasses row security, or holds any right on the application table beyond INSERT. The check asks the database (`app/privileges.py`), so it works whatever the account is called.
- `bootstrap` MUST refuse an unsafe setup before it connects: a system database, built-in role names (`postgres`, `pg_*`), roles or passwords that repeat, passwords under 24 characters, URLs for different servers or databases, and a database that already holds tables that are not KidsUp's.
- A table added later is closed to the API and retention roles until `app/bootstrap.py` grants it explicitly (grants are listed per table and column, never `ALL TABLES`).
- The database is **never** published to the internet; it is reachable only from the API's network (see `docker-compose.yml`: no `ports`, `internal` network).
- Backups are encrypted, access-controlled, tested by restore, and expire according to retention (SEC-B-09).

### SEC-B-08 Abuse protection
- Public write endpoints MUST be rate-limited (done: per-client limiter in the API plus nginx `limit_req`) and bounded in body size (done: `BodySizeLimitMiddleware`, nginx `client_max_body_size`).
- Rate limiting is **defence in depth, not a substitute for authentication**. The in-process limiter is per instance; a shared limiter (edge/Redis) MUST back it once more than one replica runs.
- Bot defence (CAPTCHA/proof-of-work/honeypot) MUST be added to the public form before public launch (see §4).
- Timeouts are set on every outbound and inbound operation; there are no unbounded loops or recursion driven by input.

### SEC-B-09 Personal data of minors and parents (privacy)
- **Minimise:** collect only fields the programme needs (names, birth date, a parent phone number, language). No national ids, photos, addresses, health or free text without a documented need.
- **Purpose limitation:** application data is used only to contact families about the programme. No analytics, advertising or resale.
- **Retention:** applications that do not result in enrolment MUST be deleted within a defined period (proposed: 12 months); enrolled records follow the programme's legal retention. The period is documented and **enforced by an automated job** (see §4).
- **Erasure:** a parent can request deletion; the operator MUST be able to delete all rows for an application within 30 days and delete it from backups at the next rotation. Deletion is real (`DELETE`), not a flag.
- **Encryption:** TLS in transit (SEC-B-06); **encryption at rest** for the database volume and backups MUST be enabled by the hosting platform and verified before launch. Field-level encryption is required if the schema ever adds more sensitive fields.
- **Access:** only named operators with a role (SEC-B-04); every read of personal data through the admin API is audit-logged (SEC-B-10). Exports are rare, justified and logged.
- **Compliance:** the operator MUST confirm the applicable personal-data law(s) with legal counsel (Azerbaijani personal-data law; GDPR where EU residents apply) and record consent/notice wording in the product. This document does not replace legal advice.

### SEC-B-10 Logging, audit and privacy of logs
- Logs MUST NOT contain personal data, secrets, tokens, request bodies or full URLs with query strings. Log **ids and event names** (`application created`, `application_id=…`). This includes the text of database errors: the engine hides bound parameters (`hide_parameters=True`), and PostgreSQL is configured not to print the failing row or statement (`log_error_verbosity=terse`, `log_min_error_statement=panic`).
- Security-relevant events MUST be logged at `WARNING`+: authentication failures, authorisation denials, rate-limit hits, validation floods, configuration errors.
- Admin actions that read or change personal data MUST be written to an **append-only audit log** with who, what, when, from where.
- Logs are structured, carry a request id, are shipped off-box, access-controlled, and retained for a defined short period.

### SEC-B-11 HTTP hardening: headers, CORS, hosts
- Every response MUST carry: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `Permissions-Policy`, and a restrictive `Content-Security-Policy` (`default-src 'none'; frame-ancestors 'none'` for JSON). In production also `Strict-Transport-Security` (implemented in `app/middleware.py`, tested in `tests/test_security.py`).
- `TrustedHostMiddleware` MUST be enabled with an explicit host list; wildcards are rejected at startup in production.
- CORS MUST use an explicit origin allow-list and the minimum methods/headers. `*`, reflected origins and credentialed wildcards are forbidden. When front and API share an origin (as behind nginx) CORS stays empty.

### SEC-B-12 Error handling without leakage
- Clients MUST NEVER receive stack traces, SQL, file paths, framework/library versions, internal hostnames or ids. Unhandled errors return a generic `500`; details go to the log with a request id.
- Authentication and authorisation failures use uniform messages. Debug mode and verbose errors are off outside local development.

### SEC-B-13 Dependencies and supply chain
- Dependencies MUST be **hash-pinned** lock files (`requirements.txt`/`requirements-dev.txt`) installed with `--require-hashes`. Direct deps are few, justified and maintained.
- `pip-audit` MUST be clean (no known vulnerabilities) before merge and weekly in CI. Critical advisories are patched within 48 hours, high within 7 days.
- Automated update PRs (Dependabot/Renovate) SHOULD be enabled; updates are reviewed, not auto-merged.
- Base images MUST be official, minimal (`-slim`), updated regularly, scanned (Trivy/Grype), and pinned by digest in production builds. Build and run as different stages when compilers are needed.
- No installing from Git URLs, personal mirrors or unverified registries. No `curl | sh` in Dockerfiles.

### SEC-B-14 Production hardening
- With `KIDSUP_ENVIRONMENT=production` the API MUST: disable `/docs`, `/redoc`, `/openapi.json`; send HSTS; refuse wildcard CORS/hosts and a database user named `postgres`; refuse to start with a database account that is more than the INSERT-only one (SEC-B-07); run without reload or debug (all implemented and tested). A trailing slash is a plain 404, never a redirect that would name an internal host.
- Configuration is validated at startup; the process refuses to start on unsafe settings rather than running insecurely.
- `/health` is the only unauthenticated operational endpoint and reveals nothing (`{"status":"ok"}`, no version, no dependency details).

### SEC-B-15 Container and runtime
- Containers MUST run as a **non-root** user, with a **read-only root filesystem**, `cap_drop: [ALL]`, `no-new-privileges`, no `privileged`, no host mounts, no Docker socket, and resource limits in orchestrated environments.
- The API and the database MUST NOT publish ports; only the reverse proxy is exposed (on loopback unless a firewall/TLS proxy is in front).
- Images contain no secrets, no source tests, no `.git`, no `.env`; `.dockerignore` enforces it. Health checks use no credentials.
- uvicorn runs with `--no-server-header` and `--no-access-log`, and trusts `X-Forwarded-For` **only** from the proxy's address range: `FORWARDED_ALLOW_IPS` is that range (a CIDR), never `*`, and the start command uses no shell so nothing in it is expanded.

### SEC-B-16 Security testing
- **Every control above MUST have at least one automated test** that fails if the control is removed (examples: headers, host check, CORS, body limit, rate limit, docs off in production, validation limits). A security fix without a regression test is incomplete.
- Static analysis (`ruff S`, `bandit`) and `pip-audit` MUST be clean on every merge.
- Before each release run a dynamic scan (OWASP ZAP baseline against the running stack) and the checklist in §6. An external penetration test is required before the admin panel goes live.

### SEC-B-17 Incident response and disclosure
- A `SECURITY.md` with a reporting contact and expected response times MUST exist before launch.
- On a suspected breach: contain (rotate secrets, revoke tokens, isolate), assess affected records, **notify regulators and affected families within the legal deadline**, fix the root cause, write a blameless post-mortem, add a regression test.

### SEC-B-18 Outbound requests and third parties
- The API makes no outbound requests today. If one is added it MUST use an allow-list of hosts, block private/link-local addresses (SSRF), set timeouts, and never forward user-supplied URLs or credentials.
- No personal data is sent to any third-party service without a documented purpose, a data-processing agreement and an entry in §5.

## 3. Compliance status (verified 2026-10-12; re-verified 2026-10-18 where the evidence says so)

✅ implemented and tested · 🟡 partial / defined but not yet verified · ❌ gap (must close; owner decides date) · ⬜ not applicable yet

| ID | Status | Evidence / what is missing |
|---|---|---|
| SEC-B-01 | ✅ | `app/schemas/application.py`; limits tested in `tests/test_applications.py` |
| SEC-B-02 | ✅ | ORM only; `ruff S` + `bandit` clean |
| SEC-B-03 | ⬜ | No authentication exists yet. **Blocker for the admin API** |
| SEC-B-04 | 🟡 | Only one public endpoint. No shared default-deny dependency yet: build it with the first protected endpoint |
| SEC-B-05 | 🟡 | Env-only config, `.env` ignored, compose refuses an empty password; `bootstrap` refuses passwords under 24 characters or repeated between accounts; the password is sent to PostgreSQL as a SCRAM verifier, never in clear (`tests/test_bootstrap.py`). The local `.env` sits in a OneDrive-synced folder: keep production secrets elsewhere (`docs/docker.md`). **No secret scanner in place** |
| SEC-B-06 | 🟡 | HSTS in production ✅. `bootstrap` keeps the `sslmode`, `sslrootcert` and timeout settings of its URLs (`tests/test_bootstrap.py`). TLS termination and `sslmode=verify-full` are deployment duties, not yet configured |
| SEC-B-07 | 🟡 | Four accounts set up by `app/bootstrap.py` (superuser, owner, API, retention); the **API account can only INSERT** and the retention account only find, delete and mark; grants are listed per table and column (`tests/test_bootstrap.py` proves every refusal against a real PostgreSQL, also on a database created before the split, rows kept; the API's real insert runs as that account). The API refuses to start with a wider account (`tests/test_privileges.py`, `tests/test_security.py`); `bootstrap` refuses unsafe setups before connecting (`tests/test_bootstrap.py`); `tests/test_compose.py` proves only `bootstrap` holds the privileged URLs. Live on the Docker stack 2026-10-19. **Stays 🟡 until the three §5 entries below carry the owner's signature**; open: no baked `pg_hba.conf` (§5 entry 1) |
| SEC-B-08 | 🟡 | Rate limit + body limit ✅ (`tests/test_security.py`). **No CAPTCHA/bot defence; limiter is per instance** |
| SEC-B-09 | 🟡 | Minimisation ✅. Consent and the notice version are recorded with every application, and only a published version is accepted ✅ (`tests/test_applications.py`). A daily `retention` job deletes applications with status `new` that are older than 365 days (never more: `KIDSUP_RETENTION_DAYS` is capped at the 12 months the notice promises) ✅; `purge-expired --dry-run` counts first; `mark-enrolled <id>` keeps a family out of the job; an unknown status is impossible (database CHECK). An operator erases one family's data on request ✅: `erase-by-phone` matches the last 9 digits (so `050…` finds `+994 50…`), lists the matches (ids and dates, no names) and deletes only after the count is typed back (`app/services/retention.py`, `app/cli.py`, `tests/test_retention.py`, `tests/test_cli.py`). **Missing:** no durable register of erasures (§5 entry 6), at-rest encryption and backups verified by the hosting platform, the retention period for enrolled families, counsel's approval of the notice (`front/docs/privacy-notice-review.md`) |
| SEC-B-10 | 🟡 | No form data and no IP addresses in the logs ✅: the API's access log is off, a rate-limit hit is logged as an event without the address, a database error carries no bound parameters (`tests/test_applications.py::test_a_database_error_never_carries_the_applicants_details`), the operator commands log ids and counts only (`tests/test_cli.py`), PostgreSQL logs neither the failing row nor the statement (`tests/test_compose.py`; live: no `STATEMENT` or `DETAIL` lines); nginx shortens the address, drops query strings and keeps its error log to critical failures (`front/src/nginxConfig.test.ts`, live-checked). Docker rotates logs by **size** (3 × 10 MB per container), not by age, so how long a line survives depends on traffic. **Missing:** structured JSON logging with a request id, shipping off the box, the audit log (before any admin read of personal data) |
| SEC-B-11 | ✅ | `app/middleware.py`, `app/main.py`; `tests/test_security.py` |
| SEC-B-12 | ✅ | Framework 500s are generic; no handlers that echo internals |
| SEC-B-13 | 🟡 | Hash-pinned locks ✅, `pip-audit` clean ✅, images scanned with Trivy on 2026-10-18 (`front` 0 and `db` 0 HIGH/CRITICAL; `back` 44, all unfixed Debian base packages: §5 entry 3). **No CI, no Dependabot, base images not digest-pinned** |
| SEC-B-14 | ✅ | `tests/test_security.py` (docs off in production, wildcards refused, the API refuses to start as a superuser or as an account that can read, and starts as the INSERT-only one; trailing slash is a 404); a database user *named* `postgres` is refused by the settings (`tests/test_config.py`), whatever the account is called by `app/privileges.py` |
| SEC-B-15 | ✅ | All five containers are non-root, read-only, `cap_drop: ALL`, `no-new-privileges`, with PID and memory limits; no host mounts, no Docker socket; only `front` is published (on loopback); the API and the jobs have no route out; `X-Forwarded-For` is trusted only from the nginx↔API range; images hold no secrets (Trivy secret scan clean). `tests/test_compose.py`, `tests/test_container.py`; built, run and live-checked 2026-10-18 |
| SEC-B-16 | 🟡 | Control tests + SAST ✅; container, compose, bootstrap and privilege tests ✅ (each control was removed once to prove its test fails); image scan done by hand ✅; OWASP ZAP baseline run by hand against the running stack ✅ (see `docs/docker.md`). **No CI** |
| SEC-B-17 | 🟡 | [`SECURITY.md`](../../SECURITY.md) written with a contact, response targets and four incident steps; the owner must confirm the contact and the times. No fuller incident runbook |
| SEC-B-18 | ✅ | No outbound requests |

## 4. Required before public launch

1. Bot defence on the form (CAPTCHA/Turnstile or equivalent) and a shared rate limiter. (SEC-B-08)
2. ~~Retention + erasure: scheduled deletion job, documented erasure procedure~~ Done 2026-10-18. Still open: verified encrypted storage and backups. (SEC-B-09)
3. ~~Separate migration and runtime database roles~~ Done 2026-10-18; the API account was cut down to INSERT-only on 2026-10-19. TLS to the database: §5 entry 2 until a managed PostgreSQL is used; the three §5 entries need the owner's signature. (SEC-B-06/07)
4. CI pipeline running the whole definition of done, `gitleaks`, `pip-audit`, image scan, plus Dependabot. (SEC-B-05/13/16)
5. Structured JSON logging with request id; audit log before any admin read of personal data. (SEC-B-10)
6. `SECURITY.md` is written (the owner confirms it); still open: an incident runbook, and legal sign-off on the privacy notice and retention. (SEC-B-09/17)
7. ~~Docker images built and scanned~~ Done 2026-10-18; ZAP baseline run (0 failures). (SEC-B-15/16)
8. The real visitor address: fill in `front/nginx/real-ip.conf` for the TLS proxy, or the rate limit treats everybody as one visitor and ten junk requests a minute lock every family out. Test it through the proxy. (SEC-B-08)
9. A durable, append-only register of erasures (date, how many, request reference, no personal data) and the identity check for an erasure request, written down. (SEC-B-09/10)
10. Pin the base images by digest. (SEC-B-13)

## 5. Accepted risks

| Date | Risk | Why accepted | Compensating control | Owner / review by |
|---|---|---|---|---|
| 2026-10-18 | 1. The one-off `bootstrap` job uses the PostgreSQL superuser, although `SEC-B-07` says no deployed service may. The API and retention job are on the same internal network as the database and PostgreSQL's default `pg_hba.conf` lets any role try to log in from it | It keeps account creation, migrations and grants automatic on every start and upgrades an existing database without losing rows | The job runs for seconds and exits; it is on the internal `data` network only, read-only, with all capabilities dropped; the API and the jobs never receive the superuser or owner password (`tests/test_compose.py`); every password is 24+ random characters and SCRAM-hashed, so guessing one over the network is not realistic; rotation: `docs/docker.md`. Planned: a baked `pg_hba.conf` allowing each role only from its own container, and `bootstrap` as an operator-started job in production | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |
| 2026-10-18 | 2. Traffic between the API and PostgreSQL is not encrypted (`SEC-B-06` wants TLS or an encrypted private network) | Both are on one host, on an internal Docker network that holds nothing else | No other container joins it; no container has raw-socket capability; ends when a managed PostgreSQL with `sslmode=verify-full` is used (`bootstrap` and the API accept the setting in their URLs) | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |
| 2026-10-18 | 3. HIGH base-image findings in the API image: Debian's `util-linux` family (`mount`, `login`, `bsdutils`, …), for which Debian publishes no fix yet (44 on 2026-10-18, see `docs/docker.md` for the latest scan) | Nothing to patch until Debian ships a fix; the image is rebuilt from a fresh base each time | The process is unprivileged, has no capabilities (`no-new-privileges` keeps the setuid tools of that package from gaining any), a read-only filesystem and no network route out; those tools are not reachable through the API; re-scan after every rebuild | Babək Allahverdizadə (project owner), **sign-off pending** / at every rebuild |
| 2026-10-19 | 4. Base images are pinned by tag (`python:3.13-slim`, `postgres:17-alpine`, `nginxinc/nginx-unprivileged:stable-alpine`), not by digest (`SEC-B-13`) | Pinning by digest stops security updates arriving until someone changes it; there is no CI yet to do that | Images are rebuilt with `--pull` and scanned before each release | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |
| 2026-10-19 | 5. nginx sits on the `edge` network, which has a route to the internet | Docker needs a non-internal network to publish a port on the host | nginx has no outbound function and no secrets; the API, the jobs and the database have no route out; at deployment the host's firewall should also block outbound traffic from the `edge` network | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |
| 2026-10-19 | 6. Erasures leave no durable record in the system (`docker compose exec` output is not kept) although the controller must be able to show that a request was handled | The register would be a new table and screen of the admin panel, which is blocked on the design | The operator keeps a written register of requests and what was done (date, how many applications, no personal data) until the admin panel exists | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |

Every entry needs an owner's name, a reason and a review date. An undated or unowned exception is invalid, and an entry whose owner has not signed it is only a proposal: the controls it excuses stay 🟡.

## 6. Pre-release security checklist

- [ ] Definition of done is green (`README.md`)
- [ ] No new endpoint is public by accident; auth and rate-limit decisions are written down
- [ ] No personal data in logs, errors, URLs, fixtures or screenshots
- [ ] `pip-audit` clean; lock files regenerated; image rebuilt from a patched base
- [ ] Production env: `KIDSUP_ENVIRONMENT=production`, explicit hosts/origins, strong unique secrets, TLS in front
- [ ] The API's database account can only INSERT (the API refuses to start otherwise); DB not published; backups encrypted and restore-tested
- [ ] `.env` and backups are not in a folder that syncs to a cloud drive; passwords were rotated if they ever were
- [ ] OWASP ZAP baseline against the running stack has no medium+ findings
- [ ] Every control touched has a test; `SEC-B-NN` ids cited in the PR description
