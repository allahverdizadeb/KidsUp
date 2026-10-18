# Admin panel documentation

**Status: blocked. The design is not ready.** Do not scaffold, pick a UI kit or invent screens until the owner delivers it
(see [`../CLAUDE.md`](../CLAUDE.md)).

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

1. Read the design fully; agree stack and structure with the owner (React + TypeScript + Vite to match `front/` by default).
2. Create `src/…` following the frontend layout; add `.claude/`, a `Dockerfile` and nginx config using the `front/nginx` headers as the baseline.
3. Agree the admin endpoints and authentication scheme with `back/` first; `back/` owns the contract.
4. Add `docs/` files specific to the admin app and replace this "blocked" notice.
