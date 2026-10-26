# Admin panel documentation

**Status: live.** The admin API (`../../back/app/panel`, documented in [`../../back/CLAUDE.md`](../../back/CLAUDE.md)), the origin's nginx (`../nginx`, `../Dockerfile`, port 8081),
the screens (`../src`, ported from `../design-source/`; layout and differences in [`../CLAUDE.md`](../CLAUDE.md)) and the live checks (`../scripts/check-security-headers.mjs`,
`../../scripts/verify-stack.ps1`) are built. An external penetration test is still required before anyone but the owner uses it (rule 9).

## How the rules below are met today (API 2026-10-21, screens 2026-10-25)

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

What the screens add to rules 1, 3, 4, 5, 6 and 7 (each has a test in `../src` that fails if the guard is taken out):

| Rule | In the screens | Test |
|---|---|---|
| 1 Nothing public | The only page without a session is the sign-in; any 401 (an expired or revoked session, found by the next request or by the 15-second poll) leaves at once, drops the unsaved page text and shows the sign-in with the reason | `src/App.test.tsx`, `src/state/LiveProvider.test.tsx` |
| 3 Short sessions | No token, session or text of a family in storage or cookies: the cookie is HttpOnly and the CSRF token lives in memory. **What the page asks for by itself** (the 15-second poll, and the reload of a list that the poll's news caused) is marked `X-Background: poll`; the API does not count it as activity (it honours the mark on a GET and on the search, a POST that only reads, and on nothing else), so a forgotten tab cannot keep its session alive. Real work (a click or a key) refreshes the session at most every two minutes. The screen keeps its own idle clock too: after the API's idle time (15 minutes) without a click or a key it leaves, with the unsaved text and the messages, and the date it reads makes a sleeping computer count. The clock is **per tab**: a second tab of the panel that is being worked in keeps the session alive on the server, while the idle tab still clears its screen | `src/api/client.test.ts`, `src/App.test.tsx` (a screen nobody touches), `src/hooks/hooks.test.tsx`, `../../back/tests/panel/test_sign_in.py` |
| 4 Least privilege | The menu, the buttons and the windows show only what the role may do (`can(permission)`); the API refuses the rest again (a coordinator cannot take an approval back, only an admin lists staff, exports, erases, edits courses and the page) | `src/pages/*.test.tsx`, `../../back/tests/panel/` |
| 5 Audit | Opening an application reads it once (and the sheet is not read again after a change); nothing here logs | `src/pages/Registrations.test.tsx` |
| 6 No personal data in URLs | The address holds only the page's name (`#reg`); a search is a `POST` body; no id, name or number in a title, a log or a message. A message in the corner says what happened and never to whom (it stays on the screen for a while, and goes with the session) | `src/pages/Registrations.test.tsx`, `src/state/ToastProvider.test.tsx` |
| 8 Data handling | A CSV download asks first: it says how many applications go into the file, what it holds and that the download is logged, and sends nothing until it is confirmed | `src/pages/Registrations.test.tsx` |
| Failure | A screen that cannot be drawn (an answer in a shape nobody expected) is replaced by one fixed message: nothing of the failure and nothing of the families stays on view | `src/App.test.tsx` (a screen that cannot be drawn) |
| 7 Locked down | One script of the origin, no inline script or style, no outside address, the typeface from the origin; `/media/<id>.webp` is the only part of the content volume the origin serves | `../../back/tests/test_admin_nginx.py`, `../../scripts/e2e_check.py` |

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

## Known gaps and owner decisions (screens)

| ID | Gap | Detail |
|---|---|---|
| ADM-1 | Colour contrast is not machine-checked | axe's rule needs real layout (as `front/docs/styling-and-accessibility-standards.md` A11Y-2); the colours were computed by hand and the pages checked by eye at 1440 and 390 px. Run Playwright + axe against the built admin before release |
| ADM-2 | Brand pink `#FF0083` with white text on buttons is 3.8:1 | The design's primary buttons; the same open decision as A11Y-1 (small pink **text** already uses `#D6006E`, 5.1:1). **AR-4** below |
| ADM-3 | No screen-reader audit recorded | Do before launch |
| ADM-4 | The users page is read-only | Accounts are made and changed by the operator's command (accepted risk 14 in `back/docs/security-standards.md`); a screen for it would need its own review |
| ADM-5 | The page preview is not the landing page's layout | It shows every section's words and pictures with the course's figures; opening the real page after "Dərc et" is the final look |
| ADM-6 | A published picture of a child | Upload one only with the parent's consent and remove it again when it is withdrawn (an admin: `DELETE /api/admin/media/{id}`; the screens do not offer picture removal yet: "Standarta qaytar" puts the page's own picture back and leaves the upload stored) |
| ADM-7 | The answers of the API are typed, not checked | `src/api/client.ts` reads a JSON answer as the type the call names. The API is our own, behind the same session; a wrong shape would show a broken screen, and the error boundary (`ErrorBoundary.tsx`) replaces it with one fixed message. A guard per endpoint (as `front/` has for the files it reads) is the next step if the API is ever shared with other clients. **Accepted risk AR-1** below |
| ADM-8 | The state of a page section in the list is a coloured dot | The design shows a dot only; the words ("Yadda saxlanmayıb", "Dərc gözləyir", "Dərc olunub") are in the hover title, in the text for screen readers and in the editor's header. For people who cannot tell the colours apart the list alone does not say it (WCAG 1.4.1). Recommended: show the word beside the dot — a change of the design, so the owner decides. **AR-2** below |
| ADM-9 | Colours of the design below 3:1 for non-text, and small captions | Borders of inputs and selects `#E3E3E3` (1.3:1), the off switch `#D6D6D6` (1.45:1), the chart bars `#FFC7E1` (1.45:1); captions of 10–13 px against the 14 px floor of the standards. All are the design's values; making them pass changes how the panel looks, so the owner decides (same family as ADM-2). Text greys were already moved to `#6B6B6B` where they sit on a tint. **AR-3** below |
| ADM-10 | Code structure from the standards review of 2026-10-26 (no behaviour) | Open and non-blocking: some files hold several components (`dashboard/Panels.tsx`, `ui/Buttons.tsx`, `ui/Pill.tsx`, `ui/Modal.tsx`) and some bodies are long (`RegistrationDrawer` `DrawerBody`, `Courses`, `Shell`, `PreviewDialog`, `CourseModal`, `FieldEditor`); booleans and handlers do not all follow the `is…`/`handle…` naming (the sign-in form and the new code do); `interface` is used where `front/` uses `type`; the outlined button's style is repeated by hand in nine places instead of using `OutlineButton`. Split them when those files are next changed |

## Accepted risks and exceptions (screens)

Each is a dated entry with an owner, as `../../CLAUDE.md` rule 5 asks; none is valid without the owner's signature.

| Date | Exception | Why accepted | Compensating control | Owner / review by |
|---|---|---|---|---|
| 2026-10-26 | **AR-1 (ADM-7)** The API's answers are typed, not checked at run time (`request<T>` in `src/api/client.ts`) | The API is our own, on the same origin and behind the same session; a guard per endpoint (about twenty shapes) was judged not worth its size now | An answer in a shape nobody expected cannot show details of the failure: `ErrorBoundary` replaces the screen with one fixed message (tested); the fake backend of the tests is typed with the same `types.ts`; the server's own texts are never shown (`lib/errors.ts`) | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |
| 2026-10-26 | **AR-2 (ADM-8)** The state of a page section in the list is shown by a coloured dot (WCAG 1.4.1) | It is the design the owner supplied; a visible word beside the dot changes how the list looks | The words are in the hover title, in the text for screen readers and in the header of the open section; recommended fix: show the word | Babək Allahverdizadə (project owner), **decision pending** / before launch, 2026-12-05 at the latest |
| 2026-10-26 | **AR-3 (ADM-9)** The design's non-text colours below 3:1 (input and select borders, the off switch, the chart bars) and captions of 10–13 px | They are the design's values; passing them changes how the panel looks | Every text colour meets 4.5:1 (the greys that did not were moved); the focus ring and the error colour are strong; the totals the chart draws (the week, the average, the whole) are also written as text beside it | Babək Allahverdizadə (project owner), **decision pending** / before launch, 2026-12-05 at the latest |
| 2026-10-26 | **AR-4 (ADM-2, the same decision as A11Y-1)** The brand pink `#FF0083` behind white text on buttons is 3.8:1 | The design's primary buttons | Small pink text already uses `#D6006E`; the buttons are large and bold | Babək Allahverdizadə (project owner), **decision pending** / before launch, 2026-12-05 at the latest |
