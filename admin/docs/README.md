# Admin panel documentation

**Status: the API and the origin are built; the screens are blocked, the design has not been delivered.** Do not scaffold, pick a UI kit or invent screens
until the owner delivers it (see [`../CLAUDE.md`](../CLAUDE.md)). What exists: the admin API (`../../back/app/panel`, documented in
[`../../back/CLAUDE.md`](../../back/CLAUDE.md)), the origin's nginx (`../nginx`, `../Dockerfile`, port 8081) and a live check of it
(`../scripts/check-security-headers.mjs`).

## How the rules below are met today (2026-10-21)

| Rule | Where it is enforced | Evidence |
|---|---|---|
| 1 Nothing public | Default deny on every route of the API; a test walks the whole OpenAPI schema | `back/tests/panel/test_panel_security.py`; live: 15 refusals without a session |
| 2 Strong authentication | Unique named accounts made only by the operator command, a one-time code for every account, Argon2id, lock-out (also for guesses made through the password form, which end every session of the account); the sign-in is decided by one conditional database statement, so parallel requests cannot reuse a code or slip through a lock | `back/tests/panel/test_sign_in.py`, `test_admin_cli.py` |
| 3 Short sessions | 15 idle minutes, 8 hours at most (neither can be configured higher), revoked on the server, `HttpOnly; Secure; SameSite=Strict`, CSRF token on every change, and the page's origin checked as an exact match whenever the browser sends it (it always does on a POST, PUT, PATCH or DELETE) | `back/tests/panel/test_sign_in.py` (look-alike origins included); checked in a real browser |
| 4 Least privilege | `viewer`, `coordinator`, `admin`; exports, erasure, courses, content, pictures, the audit log and **taking an approval back** are `admin` only (leaving `approved` sends a family's data to the retention job) | `back/tests/panel/test_rules.py` and per-route tests |
| 5 Audit | Append-only `audit_log` written by the API for every listing, view, change, export, erasure, picture upload and removal; a listing, the dashboard and an export carry the ids of the families they showed | `back/tests/panel/`, `back/tests/test_course_rules.py` |
| 6 No personal data in URLs | Searches and exports are `POST` bodies; the audit log and nginx's log hold no search term or name | `back/tests/panel/test_applications.py`, `back/tests/test_admin_nginx.py` |
| 7 Served separately and locked down | Its own container, networks and port (the panel shares a network with the database and the admin nginx only, **not with the public API**); `noindex`, `no-store`, the strict policy, `frame-ancestors 'none'`, HSTS; limits on requests per address and on the ones held open; the network allow-list is a file the operator fills in | `back/tests/test_admin_nginx.py`, `back/tests/test_compose.py`, `node admin/scripts/check-security-headers.mjs` (50/50) |
| 8 Data handling | A CSV export is `admin` only, rate-limited, audited, cells neutralised; an erasure is real and needs `?confirm=true` | `back/tests/panel/test_applications.py` |
| 9 External penetration test | **Not done: required before it goes live** | — |

## Standards that already apply

The admin panel is a React + TypeScript application and inherits **all** frontend standards unchanged:

- [`../../front/docs/coding-standards.md`](../../front/docs/coding-standards.md)
- [`../../front/docs/styling-and-accessibility-standards.md`](../../front/docs/styling-and-accessibility-standards.md) (WCAG 2.2 AA is mandatory here too)
- [`../../front/docs/testing-standards.md`](../../front/docs/testing-standards.md) (80% project-level coverage gate)
- [`../../front/docs/security-standards.md`](../../front/docs/security-standards.md) (**mandatory**) plus the stricter rules below

It consumes the API contract owned by `back/` and is protected by the backend's security standards
([`../../back/docs/security-standards.md`](../../back/docs/security-standards.md), especially `SEC-B-03`, `SEC-B-04`, `SEC-B-09`, `SEC-B-10`).

## Additional mandatory security rules for the admin panel

The admin panel exposes **personal data of children and parents** to staff. These rules are in addition to the frontend and backend standards and override any convenience:

1. **Nothing is public.** Every route and API call requires an authenticated, authorised staff member; the login page is the only anonymous page. Authorisation is enforced by the API; UI route guards are cosmetic (`SEC-F-10`, `SEC-B-04`).
2. **Strong authentication:** unique named accounts, **MFA required**, Argon2id password hashing, lockout/backoff, no shared logins, no default credentials (`SEC-B-03`).
3. **Short sessions:** ≤ 15 min idle timeout, explicit logout that revokes server-side, tokens never in `localStorage`; `HttpOnly; Secure; SameSite=Strict` cookies with CSRF protection.
4. **Least privilege roles** (e.g. viewer, coordinator, admin). Bulk export and deletion are restricted to the roles that need them and always confirmed.
5. **Audit everything that touches personal data:** who viewed, exported, edited or deleted which record, when, from where (`SEC-B-10`). Audit logs are append-only.
6. **No personal data in URLs, titles, logs, analytics, error messages or screenshots.** Lists are paginated; search terms are not placed in the query string if they can be personal data.
7. **Served separately and locked down:** its own origin or path, `noindex`, a CSP at least as strict as the public site's with **no third-party resources at all**, `frame-ancestors 'none'`, HSTS, network-restricted where possible (VPN/IP allow-list).
8. **Data handling:** exports are encrypted or delivered through a controlled channel, retention and erasure follow `SEC-B-09`, and the UI makes deletion of a family's data possible within the legal deadline.
9. **An external penetration test passes before it goes live** (`SEC-F-15`).

## To do when the design arrives

1. Read the design fully (`KidsUp Admin Panel v2.dc.html` and `support.js`, exported into `admin/design-source/`); agree stack and structure with the owner (React + TypeScript + Vite to match `front/` by default).
2. Create `src/…` following the frontend layout; add `.claude/` and a build stage in front of the existing `Dockerfile` (the `nginx/` headers stay as they are: `scripts/expected-headers.json` and `back/tests/test_admin_nginx.py` pin them).
3. Build the screens against the API that exists (`back/CLAUDE.md`, "Admin API"). If a screen needs something the API does not offer, agree it with `back/` first; `back/` owns the contract. Show an option only to the roles that may use it (the API refuses the others anyway): taking an approval back and removing a picture are for an `admin`; the sign-in page must send the `Origin` header a browser sends by itself; the answers of a refused request name the field and the kind of fault (`loc`, `type`), so the page chooses its own message.
4. Add `docs/` files specific to the admin app and replace this "blocked" notice.
