# admin: admin panel

Scope: the screens staff use to run KidsUp: applications (search, filter, status, notes, export, erasure), courses, the dashboard and the
landing page's texts and pictures. React 19 + TypeScript + Vite, served by nginx in production. Defers to `../CLAUDE.md` for conventions (including the
mandatory security baseline) and to `../back/CLAUDE.md` for the API it consumes (`/api/admin/...`, the contract owner).

## Status: live

| Part | Where | State |
|---|---|---|
| The panel API (sign-in with MFA, applications, courses, dashboard, content, pictures, staff list, audit log) | `../back/app/panel/` | live, tested (`../back/docs/`), runs in its own container `panel` |
| The admin origin: nginx with the admin security headers, the built screens, `/media/<id>.webp`, and `/api/admin/` passed to the panel | `Dockerfile`, `nginx/` | live: `docker compose up` serves it on `http://127.0.0.1:8081` |
| The screens (React) | `src/` | live: sign-in, dashboard, registrations (+ the details sheet), courses, page editor, staff list; ported from `design-source/` |
| A live check of that origin's headers and of "nothing without a session" | `scripts/check-security-headers.mjs` | `node admin/scripts/check-security-headers.mjs` |

The design is `design-source/KidsUp Admin Panel v2.dc.html` (read-only reference, like `../front/design-source/`; it links a third-party font, so it is never shipped or built).
The screens match it except for the deliberate differences listed at the end of this file (which owns that list).

## Mandatory standards (binding)

Everything in `../front/docs/` (coding, accessibility, testing with the 80% gate, security) plus the stricter admin rules in [`docs/README.md`](docs/README.md): authenticated-only, MFA,
short sessions, least-privilege roles, audit log of every access to personal data, no personal data in URLs, no third-party resources, external penetration test before go-live.
The backend side is `../back/docs/security-standards.md` (`SEC-B-03/04/09/10`).

## Commands

- `npm install`, then `npm run dev` (http://localhost:5173; `/api/admin` is proxied to the panel API on http://localhost:8001, see `../back/CLAUDE.md`; the pictures at `/media` need Docker)
- **`npm run verify`**: typecheck, lint (warnings denied), format check, tests with the 80% gate (incl. axe), audit, build. This is the definition of done.
- Individually: `npm run typecheck`, `lint`, `format` / `format:check`, `test`, `test:watch`, `test:coverage`, `audit`, `build`
- `npm run check:headers [-- <url>]`: the live check of the origin's headers (default http://localhost:8081)
- Production: `docker compose up --build` from the repo root (`../docs/docker.md`). The first account: `docker compose exec panel python -m app.panel.cli create-admin ...`.
- Live end-to-end check on a throw-away copy of the whole stack: `powershell -File ..\scripts\verify-stack.ps1` (`../docs/docker.md`).

## Layout

- `src/main.tsx` mounts `App.tsx`; `App.tsx` is the gate: loading, the sign-in page, or the shell with the page the address (`#dash`, `#reg`, `#courses`, `#cms`, `#users`) names. It sits inside `components/ErrorBoundary.tsx`,
  which replaces a screen that cannot be drawn with one fixed message. Only a page's name is ever in the address: no id, no search word, nothing about a family (admin rule 6).
- `src/api/`: the **only** place that talks to the panel API (same origin, `/api/admin`, 30 s timeout). `client.ts` adds the CSRF token (held in memory only, never in storage), marks a request the page makes by itself
  as background (`X-Background: poll`, which does not keep an idle session alive), and tells the session layer about any 401. `types.ts` mirrors `../back/app/panel/schemas/`; the API owns the contract, never invent fields.
- `src/state/`: sessions (`SessionProvider`: sign-in, sign-out, the keep-alive while somebody works, leaving at once on a 401, and leaving after the API's idle time without a click or a key), navigation, toasts (`ToastProvider`, the card is
  `components/ToastCard.tsx`), the live poll of new applications (`LiveProvider`, every 15 s, background; a change makes the lists reload themselves, also as background requests), the one side sheet for an application (`DrawerProvider`), and
  `cmsEdits.ts`, the page editor's unsaved text, kept outside the page so a change of page does not lose it and dropped on sign-out. Every context has its own `use…` file (one component or one hook per file, so `oxlint`'s `only-export-components` stays clean).
- `src/pages/`: `Dashboard`, `Registrations`, `Courses`, `Cms`, `Users`, each with its parts in a folder of the same name. `src/components/`: `Shell` (sidebar, rail, mobile drawer), `Login`, `PageHeader`, `ErrorBoundary`, `ToastCard`, `ui/` (modal, pills, buttons, fields, cards).
- `src/lib/`: pure functions with tests: `format` (every moment on the clock in Baku), `courseForm`, `cms`, `stats`, `placeholders` (the figures written as the landing page writes them), `errors` (API error → the words staff read), `status`/`roles` (the design's colours and names),
  `sx`, `icons` (the design's drawings), `styles` (the shared input look), `download` (hands a file to the browser).
- `src/hooks/`: `useAsync` (drops a stale answer; tells the loader when a run is a background one), `useOverlay` (Escape closes the top window, Tab stays in it, focus goes in and back, the page behind does not scroll), `useWidth` (the design's three layouts), `useDebounced`,
  `useFocusFirstFault` (after a refused form the focus goes to the first box marked wrong).
- `src/index.css`: the design's global rules, the self-hosted typeface (`@fontsource-variable/manrope`) and the hover classes. **The page's policy forbids style attributes in markup**, so styles go
  through React's style object (the browser accepts that), and what the design calls `style-hover` is written with `sx(base, hover)` (`lib/sx.ts`): classes `h-bg`, `h-fg`… plus custom properties.
- `src/test/`: `fakeBackend.ts` keeps the panel API in memory (sessions, CSRF, roles, seats, content, pictures), `fixtures.ts`, `app.tsx` (`openApp`), `setup.ts`.
- `nginx/`: the origin's server config and the security headers (pinned by `../back/tests/test_admin_nginx.py` and `scripts/expected-headers.json`). `public/`: only the favicon.

## Rules (the short list; the documents above are authoritative)

- No third-party resources and no CSP exceptions: the typeface is self-hosted, the policy is `'self'` only. Do not add a CDN, tracker, frame or font service.
- Never use `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `console.*`; never store personal data or a token (storage, cookies, URL, console). Everything the API sends is shown as text (React escapes it).
- The UI hides what a role may not do (`can(permission)`), but the API decides: never rely on the page for authorisation.
- A search term is a `POST` body. A name, a phone number or an id must not reach an address, a title, a log or an error message. A message in the corner (`toast`) says what happened, never to whom.
- A request the page makes **by itself** (a poll, a reload because the news changed) is a background request (`useAsync`'s `background`, `ReadOptions` in `api/client.ts`): it must not keep an idle session alive. A request a person caused is never marked.
- Messages shown to staff come from `lib/errors.ts`, chosen by the API's `code`; the server's own text is never shown.
- Every screen works at 1440, 900 and 390 px (full sidebar, icon rail, drawer) and by keyboard; the axe test (`a11y.test.tsx`) must stay at zero violations.
- Colour: the design's brand pink `#FF0083` is kept for backgrounds; small pink **text** uses the darker `#D6006E` (A11Y-1 is still an owner decision, `../front/docs/styling-and-accessibility-standards.md`).

## Deliberate differences from `design-source/`

The screens match the design except for these. Anything else that differs is a bug.

1. **Real data, real sign-in.** The design had demo data and a "signed out" card; the app signs in with the e-mail, the password and the 6-digit code (`Login.tsx`), and every figure is computed from the stored rows. The "Demo məlumatlar" chip is gone.
2. **The roles are the API's**: Admin, Menecer (`coordinator`) and Müşahidəçi (`viewer`); there is no "Redaktor", and the page editor is for admins. Navigation shows only what a role may open.
3. **Users is read-only.** No "İstifadəçi əlavə et", no role selector, no delete: accounts are made and changed by the operator's command (accepted risk 14), so nobody can give access from inside the panel. The page lists the accounts, their state and last sign-in, and says how.
4. **Registrations have one or two children**; the table and the sheet show both. A notes list (author, time) replaces the single note, an admin can take a note back, and the sheet shows the training language and the consent record.
5. **Status names** follow the design ("Təsdiqlənib", "İmtina edilib") for the API's `approved`/`declined`. Approving a family needs one free place per child; the button says why it is blocked. Leaving "Təsdiqlənib" is for admins (the API refuses a coordinator).
6. **Courses** also have the second child's price and an optional end date (the design asked for the end date; courses made before it have none). The name is made from the dates; a course named by hand keeps its name while its dates stay.
   The "single active course" switch opens the chosen course first and closes the others after it, so the landing page's form is never without a course. Only an admin changes courses.
7. **The page editor is driven by the 16 sections and 94 places of the API** (`GET /api/admin/content`), not by the design's nine simplified sections. "Dərc et" publishes one section (`keys`), "Hamısını dərc et" everything that waits. The preview is the texts and pictures of every section in the page's colours with the course's figures filled in, not a copy of the landing page's layout.
8. **Additions the brief needs**: a CSV download for admins (it asks first), a course filter, "Daha çox göstər" (25 at a time), the 15-second check for new applications with a message, the keep-alive while somebody works, leaving after 15 idle minutes, a skip link, and focus handling in every window.
9. **Contrast**: small pink text is `#D6006E` and muted grey text is `#6B6B6B`/`#767676` where the design used lighter greys that fail WCAG AA. What still falls short is listed as ADM-2, ADM-8 and ADM-9 in `docs/README.md`; the owner decides it.
10. **Pictures**: the design's "Sil" button is "Standarta qaytar" (it puts the page's own picture back; removing an uploaded file is the admin-only `DELETE /media/{id}`, ADM-6). The hint under the upload says JPG, PNG or WEBP and 5 MB (the API's limits; the design said 3 MB).
11. **"Son dərc"** is the time of the page's last publication, shown on every section (the API keeps one publication history for the whole page; the design had a time for each section).
12. **Small additions to what the design shows**: the course price on the seats card of the dashboard, the children's dates of birth in the details sheet, a note when more than one course is open on the site, counters and "Standarta qaytar" in the page editor,
    a count text "N müraciətdən M tapıldı" (the design said "göstərilir"), price fields that take a comma or a dot (text with a decimal keyboard, not a number input), icon greys `#A3A3A3` where the design had `#C2C2C2`.
13. **Words that do not change**: the course switch always says "Saytda aktiv" and the switch itself shows whether it is on (the name of a switch must not flip, WCAG 2.5.3). Messages in the corner: a success stays six seconds and waits while the pointer or the focus is on it; a failure stays until it is closed (WCAG 2.2.1).
