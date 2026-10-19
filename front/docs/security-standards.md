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
- The CSP is delivered as an **HTTP header** by nginx (`nginx/csp-page.conf` for the page and its files, `nginx/csp-api.conf` for the API's JSON), not a `<meta>` tag. Required directives of the page's policy:
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
- Autofill is explicit: `autoComplete` is set deliberately (`name`, `tel` for the parent; `off` for the child's name **and** birth date) so browsers do not store or fill in children's details.

### SEC-F-07 Forms and user input
- Client-side validation exists for **usability only**; the server is authoritative (`SEC-B-01`). Client rules MUST mirror the API contract owned by `back/CLAUDE.md` (the limits live there; `maxLength` equals them) so honest users never hit a server rejection.
- Prevent accidental double submission (button disabled while sending, guard in the handler) and never retry a `POST` automatically.
- Error messages tell the user what to fix without revealing server internals. Never put user input into an error message as HTML.
- The public form MUST have bot defence (CAPTCHA/Turnstile or proof-of-work, loaded in compliance with SEC-F-02/03) before launch (§4). A visually hidden honeypot field is a cheap complement.
- Data typed by the visitor is never logged, never put in analytics events, never copied to the clipboard automatically.

### SEC-F-08 API communication
- The browser talks only to its own origin (`/api/…` via nginx). `VITE_API_URL` may point to another origin only if that origin is HTTPS and is added to `connect-src` and to the API's CORS allow-list.
- All requests go through `src/api/`. Each request has a **timeout** (`AbortSignal.timeout`), a fixed method and a JSON body built from an explicit object (never `JSON.stringify` of a whole form/state). Credentials/tokens never go in URLs.
- Responses are **untrusted**: validate the shape (`unknown` → checked type) before using them; never inject them into HTML; treat any non-2xx as failure with a generic user message. Today nothing from the answer is used, so none of it is read (`submitApplication` returns nothing, tested).
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
- Every response from nginx carries: CSP (SEC-F-02; the API's JSON gets its own strict one, `default-src 'none'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb denied), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (the page loads nothing cross-origin, so the page is cross-origin isolated), HSTS. The exact values are in `scripts/expected-headers.json`, which both the live check and `src/nginxConfig.test.ts` read. `server_tokens` is off. `add_header` is repeated via the shared includes in every location and once at server level, for the answers nginx gives before it has chosen a location (400, 414, 431); nginx drops inherited headers as soon as a level sets its own, so nothing is sent twice.
- Methods are restricted (static: `GET/HEAD`; API: **only `POST /api/applications` is passed on**, everything else under `/api/` is nginx's own 404); dotfiles are denied; request bodies and header timeouts are capped; the API proxy rate-limits per client (`limit_req`), overwrites `X-Forwarded-For`, drops the API's own copies of the security headers and ignores its `X-Accel-*` headers, and looks the API up again by name as its address changes.
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
- The consent box starts **unticked**; the API refuses an application without it and records when and for which notice version it was given. The points counsel must confirm are in [`privacy-notice-review.md`](privacy-notice-review.md).

### SEC-F-17 Static downloads and owner-supplied files
- Files such as the brochure PDF and the certificate image live only in `public/assets/`, are reviewed by a person before they are committed, and are never uploaded by visitors: nothing a visitor supplies is ever served from this origin.
- nginx serves them with their exact MIME type, `nosniff` and the shared security headers, never as `immutable` (their names are not fingerprinted), and answers `404`, never the page, for a missing one. A PDF is a **download** (`Content-Disposition: attachment`), never displayed from this origin.
- A PDF has no JavaScript, launch or submit actions, forms or embedded files; an image has no text, EXIF or XMP metadata that could identify a person (a provenance chunk such as C2PA is fine). Documents contain placeholders, never real personal data of a child or a parent.
- Pages refer to them with root-absolute URLs (`/assets/…`), so they also load when the page is opened on a deep path. Figures in a document (prices, dates, phone numbers) match the page and are re-exported when the page changes.
- A document is readable by assistive technology: real text, or an accessible alternative on the page (`A11Y-4` in the styling standard is the open gap).
- **Everything** under `public/` (not only what the page links to) is on a reviewed list with its SHA-256 (`REVIEWED_PUBLIC_FILES` in `src/publicAssets.test.tsx`): a new, changed or removed file fails the test until a person has looked at it and recorded the new fingerprint. Only images and PDFs are allowed there. That list is the record of the review, including that a C2PA provenance box in `babek.jpeg` was seen and names no person.
- Tests: `src/publicAssets.test.tsx` (exists, complete, size and page claims, the reviewed list, SVGs without script or outside references, no PNG text chunks and no JPEG EXIF/XMP/IPTC/comment segments, PDFs without author fields, scripts, launch actions, links, forms, attachments or encryption, also when a name is spelled with `#xx` escapes) and `npm run check:headers` (type, headers, download, 404). That figures in a document match the page and that it holds no real personal data cannot be tested: they are on the checklist in §6.

## 3. Compliance status (verified 2026-10-12; re-verified 2026-10-18 where the evidence says so)

✅ implemented and verified · 🟡 partial / defined but not yet verified · ❌ gap (must close) · ⬜ not applicable yet

| ID | Status | Evidence / what is missing |
|---|---|---|
| SEC-F-01 | ✅ | Lint rules proven active; `App.test.tsx` forbids inline handlers/scripts; Trusted Types enforced and verified in Edge with zero violations; injected inline `<script>` blocked |
| SEC-F-02 | ✅ | `nginx/csp-page.conf`, `nginx/csp-api.conf`; verified by `npm run check:headers` (54/54 against the built Docker image, 2026-10-19: the policy is compared directive by directive on every kind of answer) and in a real browser against it: zero CSP/Trusted Types violations in the console |
| SEC-F-03 | ✅ | Browser network log against the Docker image (2026-10-18): every request stays on the own origin; the font and the Wharton credential image are self-hosted; `App.test.tsx` and `check:headers` (`img-src 'self'`) guard it |
| SEC-F-04 | 🟡 | `package-lock.json` ✅, `npm audit` = 0 ✅. **No CI, no Dependabot/Renovate yet** |
| SEC-F-05 | ✅ | No secrets in bundle; zero source maps; `no-console` |
| SEC-F-06 | ✅ | No storage or cookies. The WhatsApp fallback link (`Apply.tsx`, `WHATSAPP_FALLBACK_URL`) carries a fixed greeting and never the parent's or children's details; `Apply.test.tsx` fails if any link contains typed details. (It did carry them until 2026-10-18.) The child's name and birth date have `autoComplete="off"` (tested) |
| SEC-F-07 | 🟡 | Validation mirrors API, `maxLength` set, double-submit blocked ✅. **No bot defence yet** |
| SEC-F-08 | ✅ | Same-origin, 10 s timeout, tested. The answer of the API is not read at all (`submitApplication` returns nothing), so there is nothing to validate |
| SEC-F-09 | ✅ | Lint `jsx-no-target-blank` enforces `noopener noreferrer` on every `target="_blank"` link; component tests cover some of them |
| SEC-F-10 | ⬜ | No authentication in the frontend yet. **Blocker for the admin panel** |
| SEC-F-11 | 🟡 | Every nginx answer carries the exact documented headers, once each: all locations, the answers nginx makes itself (400, 403, 404, 405, 413, 414) and the proxied API answer, where the API's own copies are dropped; the rate limit, the `X-Forwarded-For` overwrite and the body cap are asserted too (`src/nginxConfig.test.ts` plus `npm run check:headers`: 54 checks, live 2026-10-19). **Stays 🟡: TLS and HSTS in front are the deployer's job** (`docs/docker.md`) |
| SEC-F-12 | ✅ | Build output ✅ (no maps, hashed assets). Image built, run and scanned 2026-10-19 ✅: non-root (nginx uid 101, API uid 10001), read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, no host mounts, only `front` published (on 127.0.0.1), the image holds only `dist/` and its config; Trivy: 0 HIGH/CRITICAL findings in the front image (`docs/docker.md`). No CI yet is `SEC-F-04`/`SEC-F-15` |
| SEC-F-13 | ✅ | `frame-ancestors 'none'` + `X-Frame-Options` verified |
| SEC-F-14 | ✅ | `no-console` lint; generic messages; `ErrorBoundary` wraps the app (`src/components/ErrorBoundary.tsx`, tested to leak nothing) |
| SEC-F-15 | 🟡 | Component tests, axe (also with the notice open and after an incomplete submit), lint (scripts included), `check:headers` (policies compared exactly) ✅; each control touched in the 2026-10-19 work was removed once to prove its test fails ✅; OWASP ZAP baseline run against the built stack by hand ✅ (0 failures, 65 rules passed; `docs/docker.md`); the browser run was repeated with zero CSP/Trusted Types violations. **No CI; the in-browser CSP test is a manual procedure, not yet a repo test** |
| SEC-F-16 | 🟡 | The form shows the notice (`Məxfilik bildirişini oxu`, also from the footer link, which opens it every time), starts with an unticked consent box, refuses to send without it, and the API records the time and the notice version and accepts only a version that was shown (`PrivacyConsent.test.tsx`, `Apply.test.tsx`, `privacyNotice.test.ts`, `back/tests/test_applications.py`). **The wording is a draft pending counsel's approval**: [`privacy-notice-review.md`](privacy-notice-review.md) lists every point to confirm |
| SEC-F-17 | 🟡 | Tests and live checks in place (see the control), including the reviewed list of everything under `public/`. **Open:** the brochure PDF has no text layer (`A11Y-4`); it is registered as an exception in §5 |

## 4. Required before public launch

1. Counsel's approval of the privacy notice and of the consent mechanism. Both are built (2026-10-18) with draft wording: [`privacy-notice-review.md`](privacy-notice-review.md). (SEC-F-16)
2. Bot defence on the form, in compliance with the CSP. (SEC-F-07)
3. CI running `npm run verify`, `npm run check:headers` against a built stack, and dependency update PRs. (SEC-F-04/15)
4. ~~OWASP ZAP baseline clean~~ Done 2026-10-19: no failures; two informational warnings that are accepted (static files are cacheable by design and hold no personal data; a note that the page is a single-page app). (SEC-F-12/15)
5. TLS in front with HSTS; consider HSTS preload only after every sub-domain is HTTPS. Then fill in `nginx/real-ip.conf` with the proxy's range and test it through the proxy, or the rate limit sees every visitor as one. (SEC-F-11)
6. ~~Replace the accredible.com hot-linked image with a self-hosted copy~~ Done 2026-10-18 with the owner's approval. The issuer's URL redirected to a second host (`artifacts.credential.net`), so the CSP blocked the image; the CSP now has no third-party origin. (SEC-F-03)
7. ~~Decide what the WhatsApp fallback may carry~~ Done 2026-10-18 with the owner's decision: no personal data in the `wa.me` link. (SEC-F-06/16)

## 5. Accepted risks and exceptions

| Date | Exception | Why accepted | Compensating control | Owner / review by |
|---|---|---|---|---|
| 2026-10-19 | The brochure PDF has no text layer (`A11Y-4`): it is two images | The owner supplies the file; a text-based export is awaited | The page describes the brochure in text (pages, size) and the PDF is a download | Babək Allahverdizadə (project owner), **sign-off pending** / before launch, 2026-12-05 at the latest |

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
- [ ] Every new or changed file under `public/` was opened and read by a person: no real personal data of a child or a parent, figures (prices, dates, phone numbers) match the page
