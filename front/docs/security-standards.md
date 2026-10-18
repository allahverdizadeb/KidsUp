# Frontend security standards

> ## MANDATORY, HIGHEST PRIORITY
>
> Security is a **hard requirement** of this project, not a quality goal. This site collects **personal data of
> children and their parents** from the public internet. Every control below with **MUST** is mandatory for every
> change, every environment and every contributor, human or AI. A change that violates a control MUST NOT be
> merged, however small or urgent. Security overrides speed, design preference, convenience and every other document.
>
> The matching backend rules are in [`../../back/docs/security-standards.md`](../../back/docs/security-standards.md).
> Security is enforced on **both** sides. The frontend is an untrusted environment: the browser is controlled by
> the user, so **nothing the frontend does replaces server-side validation, authorisation or rate limiting**, and
> the frontend MUST still defend itself and its visitors against injection, tampering, tracking and leakage.

Words follow RFC 2119. Controls have stable IDs (`SEC-F-NN`) so reviews, tests and code comments can cite them.

## 1. Assets and threat model

| Asset | Risk |
|---|---|
| Personal data typed into the application form (child names and birth dates, parent name and phone) | Interception, theft by injected script, leakage to third parties, leftover in storage/logs |
| The visitor's browser and trust in the page | XSS, clickjacking, malicious third-party code, phishing look-alikes |
| The integrity of what the page tells families (prices, dates, contact numbers) | Defacement / tampering |
| Visitor privacy | Tracking, third-party requests that reveal IP addresses, fingerprinting |

Attackers considered: anonymous attackers injecting script or links, compromised npm packages or CDNs, malicious browser
extensions (out of scope to prevent, in scope not to make worse), network attackers, and anyone embedding the page in a hostile frame.

## 2. Controls

### SEC-F-01 Cross-site scripting (XSS) prevention
- Render dynamic values only as React text/attribute values (React escapes them). The following are **forbidden**: `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML`/`insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `setTimeout("string")`, `javascript:` and `data:` URLs. Lint enforces it (`react/no-danger`, `no-eval`, `no-implied-eval`, `no-new-func`, `react/jsx-no-script-url`).
- A URL taken from data MUST be checked against an allow-list of schemes (`https:`, `tel:`, `mailto:`) before it reaches `href`/`src`. Static links in JSX are fine.
- **Trusted Types are enforced** (`require-trusted-types-for 'script'` in the CSP). Code MUST NOT introduce a DOM sink that needs a policy; if one ever becomes unavoidable, a named Trusted Types policy with sanitisation and a review entry in §5 is required.
- If rich text from a CMS/API is ever displayed it MUST be sanitised with a maintained library (DOMPurify) behind a Trusted Types policy, never by hand.

### SEC-F-02 Content Security Policy
- The CSP is delivered as an **HTTP header** by nginx (`nginx/security-headers.conf`), not a `<meta>` tag. Required directives:
  `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' <documented exceptions>; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'`.
- `'unsafe-inline'`, `'unsafe-eval'`, wildcards and `data:` for scripts/styles are **forbidden**. (React sets styles through the CSSOM, which CSP does not restrict, so inline `style` props work without relaxing `style-src`. Vite is configured with `assetsInlineLimit: 0` so no asset becomes a `data:` URI.)
- Loosening the CSP is a security change: it needs an entry in §5 and a reviewer's sign-off. Tightening is always welcome.
- Any change to markup, assets or third-party use MUST be checked against the CSP in a real browser (zero violations, `npm run check:headers`).

### SEC-F-03 Third-party code and resources
- **No third-party scripts, styles, fonts, frames or tags at runtime.** Fonts are self-hosted (`@fontsource-variable/manrope`). No CDN-hosted libraries. No analytics, A/B, chat, tag-manager, advertising or social widgets. (Leaking visitors' IP addresses to third parties is a privacy harm, especially for a site about children.)
- Allowed exceptions are listed in §5 with owner and reason. Today: **none**. `App.test.tsx` fails if any `src` leaves the own origin, and `npm run check:headers` fails if `img-src` allows anything but `'self'`. History: §4 and §5.
- If an external script/style is ever unavoidable it MUST use Subresource Integrity (`integrity` + `crossorigin`), a pinned version and a CSP entry for that exact origin.
- Outbound **navigation** (WhatsApp, LinkedIn, credential page) is not a resource load, but see SEC-F-09.

### SEC-F-04 Dependencies and supply chain
- `package-lock.json` MUST be committed and installs use `npm ci`. `npm audit --audit-level=high` MUST pass on every merge (part of `npm run verify`); critical advisories are patched within 48 hours, high within 7 days.
- New dependencies need a written reason, active maintenance, a compatible licence, a clean audit and a bundle-size check. Prefer platform APIs over packages. Runtime dependencies stay minimal (today: React, ReactDOM, one font).
- Prefer exact, reviewed upgrades via Dependabot/Renovate PRs; never auto-merge. Do not install packages from Git URLs, tarballs or unknown registries. Review `postinstall`/lifecycle scripts of new packages.
- The container build uses the lock file (`npm ci`), a pinned Node major, and a minimal unprivileged nginx runtime image that is rebuilt regularly.

### SEC-F-05 Secrets and configuration
- **Nothing in the bundle is secret.** Every `VITE_*` variable is public by design and is visible to every visitor. API keys, tokens, passwords and private URLs MUST NEVER be placed in the frontend, in `.env*` files that get built in, in comments, or in test fixtures.
- Production builds publish no source maps (verified: zero `.map` files in `dist/`). Debug code, feature flags that expose hidden pages, and `console` output are removed (`no-console`, `no-debugger`).
- Configuration differs per environment through build-time variables only (`VITE_API_URL`), never through user-controllable query strings.

### SEC-F-06 Client-side storage and privacy
- Personal data MUST NOT be written to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL (path, query, hash) or the page title, and MUST NOT be sent to anything except the application API. The form keeps data in component memory only and drops it with the page.
- The site MUST NOT set tracking cookies or fingerprint visitors. Any future analytics requires explicit consent, a privacy-friendly self-hosted tool, IP anonymisation and a documented legal basis.
- Autofill is explicit: `autoComplete` is set deliberately (`name`, `tel`, `off` for children's data) so browsers do not store children's details.

### SEC-F-07 Forms and user input
- Client-side validation exists for **usability only**; the server is authoritative (`SEC-B-01`). Client rules MUST mirror the API contract (phone characters and 9–12 digits, names required, **`maxLength` equal to the API limits**: 120 for names, 32 for phone) so honest users never hit a server rejection.
- Prevent accidental double submission (button disabled while sending, guard in the handler) and never retry a `POST` automatically.
- Error messages tell the user what to fix without revealing server internals. Never put user input into an error message as HTML.
- The public form MUST have bot defence (CAPTCHA/Turnstile or proof-of-work, loaded in compliance with SEC-F-02/03) before launch (§4). A visually hidden honeypot field is a cheap complement.
- Data typed by the visitor is never logged, never put in analytics events, never copied to the clipboard automatically.

### SEC-F-08 API communication
- The browser talks only to its own origin (`/api/…` via nginx). `VITE_API_URL` may point to another origin only if that origin is HTTPS and is added to `connect-src` and to the API's CORS allow-list.
- All requests go through `src/api/`. Each request has a **timeout** (`AbortSignal.timeout`), a fixed method and a JSON body built from an explicit object (never `JSON.stringify` of a whole form/state). Credentials/tokens never go in URLs.
- Responses are **untrusted**: validate the shape (`unknown` → checked type) before using them; never inject them into HTML; treat any non-2xx as failure with a generic user message.
- Failures degrade gracefully (WhatsApp fallback) and never expose a stack trace or raw server message to the visitor.

### SEC-F-09 Links and navigation
- Every link that opens a new tab (`target="_blank"`) MUST have `rel="noopener noreferrer"` (lint: `react/jsx-no-target-blank`). External destinations are static, reviewed HTTPS URLs or `tel:`/`https://wa.me/…`.
- Never build a link from unvalidated data; never redirect to a URL taken from the query string (open redirect).

### SEC-F-10 Authentication and sessions (required for the admin panel)
- Tokens MUST NOT be stored in `localStorage`/`sessionStorage`. Use `HttpOnly; Secure; SameSite=Strict` cookies set by the API, or memory-only access tokens with a refresh cookie.
- With cookie authentication, state-changing requests MUST carry CSRF protection (SameSite=Strict plus a token or custom header checked by the API).
- Sessions expire on idle (≤ 15 min for admin), there is an explicit logout that revokes server-side, and the UI never trusts its own role flags: **authorisation is the API's job** (`SEC-B-04`). Route guards are UX only.
- Admin screens are never reachable from the public site's navigation and are served with `noindex`, a stricter CSP and no third-party resources whatsoever.

### SEC-F-11 Transport and headers
- Production MUST be HTTPS only (TLS 1.2+), with `Strict-Transport-Security` (≥ 1 year, `includeSubDomains`), no mixed content, and HTTP redirected to HTTPS at the TLS proxy.
- Every response from nginx carries: CSP (SEC-F-02), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb denied), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, HSTS. `server_tokens` is off. `add_header` is repeated via the shared include in every location (nginx drops inherited headers otherwise).
- Methods are restricted (static: `GET/HEAD`; API: what the API needs); dotfiles are denied; request bodies and header timeouts are capped; the API proxy rate-limits per client (`limit_req`) and overwrites `X-Forwarded-For`.
- `npm run check:headers` verifies all of the above against a running stack and MUST pass before release.

### SEC-F-12 Build and deployment
- Only the production build is deployed (`npm run build`); the Vite dev server (`npm run dev`) is never exposed beyond localhost.
- The image runs unprivileged nginx (non-root, port 8080), read-only root filesystem, `cap_drop: [ALL]`, `no-new-privileges`, and contains only `dist/` and its config (no source, tests, `.env`, `design-source/`).
- Fingerprinted assets are immutable-cached; `index.html` is `no-cache` so a security fix reaches visitors immediately.

### SEC-F-13 Clickjacking and embedding
- The page MUST NOT be framable: `frame-ancestors 'none'` plus `X-Frame-Options: DENY`. The site MUST NOT embed third-party frames.

### SEC-F-14 Error handling and logging in the browser
- The UI shows generic, helpful messages. It never shows stack traces, status codes beyond what a user needs, server messages or request ids with personal data.
- `console.*` is forbidden in `src/` (lint). Error reporting, when added, is a first-party endpoint that **strips personal data** and needs a privacy review.
- A render error MUST NOT blank the page or leak details: the app is wrapped in an error boundary that shows a minimal fallback with the contact options.

### SEC-F-15 Security testing
- **Every control above MUST have an automated check that fails if the control is removed**: unit/component tests (e.g. `rel` on external links, input limits, request timeout, no inline handlers), the axe accessibility test, lint rules, and `npm run check:headers` for the server-delivered controls.
- A change that touches markup, assets, nginx or third-party use MUST also be exercised in a real browser against the production build with the real CSP: zero CSP/Trusted Types violations in the console, and an injected inline `<script>` MUST be blocked.
- Before each release: run the OWASP ZAP baseline against the running stack and fix medium+ findings. An external penetration test is required before the admin panel goes live.

### SEC-F-16 Privacy of children (privacy by design)
- The form MUST present a **privacy notice** before submission: who collects the data, for what purpose, how long it is kept, who can see it, how to request deletion, and a contact. Where the law requires parental consent, the form obtains and records it. Wording is approved by legal counsel.
- Collect the minimum; no profiling, no marketing to children, no sale or sharing of data, no dark patterns. Children never interact with the form themselves (parents do).
- Applicable law (Azerbaijani personal-data law; GDPR/children's-data rules where relevant) MUST be confirmed with counsel and reflected in the notice and in `SEC-B-09`.

## 3. Compliance status (verified 2026-10-12; SEC-F-02, 03 and 12 re-verified 2026-10-18)

✅ implemented and verified · 🟡 partial / defined but not yet verified · ❌ gap (must close) · ⬜ not applicable yet

| ID | Status | Evidence / what is missing |
|---|---|---|
| SEC-F-01 | ✅ | Lint rules proven active; `App.test.tsx` forbids inline handlers/scripts; Trusted Types enforced and verified in Edge with zero violations; injected inline `<script>` blocked |
| SEC-F-02 | ✅ | `nginx/security-headers.conf`; verified by `npm run check:headers` (40/40 against the built Docker image, 2026-10-18) and in a real browser against it: zero CSP/Trusted Types violations in the console |
| SEC-F-03 | ✅ | Browser network log against the Docker image (2026-10-18): every request stays on the own origin; the font and the Wharton credential image are self-hosted; `App.test.tsx` and `check:headers` (`img-src 'self'`) guard it |
| SEC-F-04 | 🟡 | `package-lock.json` ✅, `npm audit` = 0 ✅. **No CI, no Dependabot/Renovate yet** |
| SEC-F-05 | ✅ | No secrets in bundle; zero source maps; `no-console` |
| SEC-F-06 | ✅ | No storage or cookies. The WhatsApp fallback link (`Apply.tsx`, `WHATSAPP_FALLBACK_URL`) carries a fixed greeting and never the parent's or children's details; `Apply.test.tsx` fails if any link contains typed details. (It did carry them until 2026-10-18.) |
| SEC-F-07 | 🟡 | Validation mirrors API, `maxLength` set, double-submit blocked ✅. **No bot defence yet** |
| SEC-F-08 | ✅ | Same-origin, 10 s timeout, tested. Response shape is trivial (`{id}`) and unused beyond success |
| SEC-F-09 | ✅ | Lint `jsx-no-target-blank` enforces `noopener noreferrer` on every `target="_blank"` link; component tests cover some of them |
| SEC-F-10 | ⬜ | No authentication in the frontend yet. **Blocker for the admin panel** |
| SEC-F-11 | 🟡 | `check:headers` + nginx config ✅ for the static locations. **The `/api/` and dotfile locations do not include the header snippet, so nginx's own 429/413/403 responses carry none of the headers** (`nginx/default.conf`); TLS/HSTS preload is the deployer's job |
| SEC-F-12 | 🟡 | Build output ✅ (no maps, hashed assets). Images built and run 2026-10-18 ✅: non-root (nginx uid 101, API uid 10001), read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, no host mounts, only `front` published (on 127.0.0.1), the image holds only `dist/` and its config. **Not yet scanned (Trivy/Grype); no CI** |
| SEC-F-13 | ✅ | `frame-ancestors 'none'` + `X-Frame-Options` verified |
| SEC-F-14 | ✅ | `no-console` lint; generic messages; `ErrorBoundary` wraps the app (`src/components/ErrorBoundary.tsx`, tested to leak nothing) |
| SEC-F-15 | 🟡 | Component tests, axe, lint, `check:headers` ✅. **No CI, no ZAP run, in-browser CSP test is a manual procedure, not yet a repo test.** `check:headers` matches CSP directives by substring: only `img-src` is anchored, `connect-src` and `font-src` are not checked exactly |
| SEC-F-16 | ❌ | **No privacy notice or consent on the form.** The site collects children's data without one |

## 4. Required before public launch

1. **Privacy notice and (if required) parental consent** on the form, approved by counsel. (SEC-F-16)
2. Bot defence on the form, in compliance with the CSP. (SEC-F-07)
3. CI running `npm run verify`, `npm run check:headers` against a built stack, and dependency update PRs. (SEC-F-04/15)
4. Docker image scanned (Trivy/Grype); OWASP ZAP baseline clean. (Built and run: done 2026-10-18.) (SEC-F-12/15)
5. TLS in front with HSTS; consider HSTS preload only after every sub-domain is HTTPS. (SEC-F-11)
6. ~~Replace the accredible.com hot-linked image with a self-hosted copy~~ Done 2026-10-18 with the owner's approval. The issuer's URL redirected to a second host (`artifacts.credential.net`), so the CSP blocked the image; the CSP now has no third-party origin. (SEC-F-03)
7. ~~Decide what the WhatsApp fallback may carry~~ Done 2026-10-18 with the owner's decision: no personal data in the `wa.me` link. (SEC-F-06/16)

## 5. Accepted risks and exceptions

| Date | Exception | Why accepted | Compensating control | Owner / review by |
|---|---|---|---|---|
| none | No active exceptions | | | |

Closed: the `img-src https://api.accredible.com` exception (Wharton credential image, accepted 2026-10-12) ended on 2026-10-18, when the image was self-hosted with the owner's approval.

An undated or unowned exception is invalid.

## 6. Pre-release security checklist

- [ ] `npm run verify` is green
- [ ] `npm run check:headers` is green against the production build behind nginx
- [ ] Browser console shows zero CSP / Trusted Types violations; network tab shows no third-party host beyond §5
- [ ] No personal data in storage, URL, console, screenshots or fixtures
- [ ] New/changed external links have `rel="noopener noreferrer"`; no new third-party resources
- [ ] No `VITE_*` value is secret; no source maps; no debug code
- [ ] Privacy notice is present and current; every control touched has a test and its `SEC-F-NN` id is cited in the PR
