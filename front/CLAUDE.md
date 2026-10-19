# front: public landing page

Scope: everything the visitor sees. React 19 + TypeScript + Vite, served by nginx in production. Defers to `../CLAUDE.md`
for cross-project conventions (including the mandatory security baseline) and to `../back/CLAUDE.md` for the API contract.

## Mandatory standards (read before changing code; they are binding)

| Document | Governs |
|---|---|
| [`docs/security-standards.md`](docs/security-standards.md) | **Security is mandatory, highest priority** (`SEC-F-NN`): XSS/Trusted Types, strict CSP, no third parties, forms, links, privacy of children, owner-supplied files |
| [`docs/coding-standards.md`](docs/coding-standards.md) | Layout, **naming**, TypeScript, React, dependencies |
| [`docs/styling-and-accessibility-standards.md`](docs/styling-and-accessibility-standards.md) | Tokens, responsive rules, **WCAG 2.2 AA mandatory** |
| [`docs/testing-standards.md`](docs/testing-standards.md) | Test design and the **80% project-level coverage gate** |

Skills/agents: [`.claude/`](.claude/) (`verify-frontend`, `new-component`, `add-api-call`, agent `frontend-reviewer`).

## Commands

- `npm install`, then `npm run dev` (http://localhost:5173; `/api` is proxied to http://localhost:8000)
- **`npm run verify`**: typecheck, lint (warnings denied), format check, tests with the 80% gate (incl. axe), audit, build. This is the definition of done.
- Individually: `npm run typecheck`, `lint`, `format` / `format:check`, `test`, `test:watch`, `test:coverage`, `audit`, `build`
- `npm run check:headers [-- <url>]`: verifies CSP/headers/blocked methods of a **running** stack (default http://localhost:8080)
- Production: `docker compose up --build` from the repo root (nginx image, see `../docs/docker.md`). Set `VITE_API_URL` only if the API lives on another origin.

## Layout

- `src/App.tsx`: page = one component per section, in page order. `src/main.tsx` mounts it inside `ErrorBoundary`.
- `src/components/`: one file per section/component + its test. Markup and inline styles are a faithful port of the design: **keep them
  as they are** unless the design changes. The only differences from `design-source/` are the ones listed under "Deliberate differences" below.
- `src/content/`: copy that is data (modules, FAQ, lesson timeline). Edit text here, not in JSX.
- `src/hooks/`: `useHover`, `useWidth`, `useReveal`. `src/lib/hover.ts`: the colour/transform table behind illustration hovers.
- `src/styles/hover.css`: pseudo-state rules (was generated from the design; **now hand-maintained**). `!important` is deliberate.
- `src/api/`: the only place that talks to `back/` (10 s timeout, same origin).
- `nginx/`: production server config and the security headers (CSP incl. Trusted Types). `scripts/`: dependency-free tooling.
- `public/assets/`: images and the brochure PDF. `design-source/`: the original design export. Read-only (see `../CLAUDE.md`), never built or imported.

## Application form (`components/Apply.tsx`)

Fields: parent name, phone, one or two children (name, birth date), preferred training languages (`Azərbaycan`, `Rus`, `İngilis`).
Validation mirrors the contract in `../back/CLAUDE.md` (the limits are owned there; `maxLength` equals them), at least one language.
The consent box and the privacy notice are `components/PrivacyConsent.tsx`; how they work, and the draft wording that awaits counsel, are in `docs/privacy-notice-review.md` (`SEC-F-16`).
Change `src/content/privacyNotice.ts` and `PRIVACY_NOTICE_VERSION` together (`privacyNotice.test.ts` fails otherwise, and the API must know the new version first).
A child's age on the program start date (2026-12-05) outside 8–13 only shows a warning, as designed; it does not block submission.
Submit calls `POST /api/applications` (`src/api/applications.ts`) with the details plus `consent: true` and the notice version. On success a confirmation
replaces the form action; on failure a WhatsApp link (`+994 50 998 87 07`) with a plain greeting is shown as the fallback. It never carries parent or child
details (`SEC-F-06`; a test covers it).

## Rules (the short list; the documents above are authoritative)

- No third-party resources and no CSP exceptions: the font and the founder's Wharton credential image are self-hosted, the CSP is `'self'` only. Do not add a CDN, tracker or frame.
- Never use `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `console.*`; external links need `rel="noopener noreferrer"` (lint enforces all of these).
- Never store personal data (storage, cookies, URL, console). Never put a secret in the bundle: every `VITE_*` value is public.
- API base URL comes from `VITE_API_URL`, never hard-coded. Keep API types next to the call in `src/api/`.
- New names follow `docs/coding-standards.md` §4. The terse names from the design runtime (`ls0`, `qz_`, `eParentB`, `h1box`) are **legacy debt**: never add more, rename when you touch them.
- Accessibility: labelled inputs, visible focus, keyboard paths, ARIA state props, `prefers-reduced-motion`. The axe test must stay at zero violations.
- Known open items: brand pink fails AA for small text (A11Y-1); the brochure PDF has no text layer (A11Y-4); the privacy notice wording awaits counsel (`SEC-F-16`); no bot defence yet. See the documents.
- `style` objects mixing `textDecoration` with `textDecorationColor`/`Thickness` trigger React warnings: use `textDecorationLine`.

## Deliberate differences from `design-source/`

The port matches the design except for these, all decided with the owner. Anything else that differs is a bug.

1. The founder's Wharton credential image is self-hosted (`public/assets/wharton-sertifikat.png`); the design hot-links it, which the CSP forbids.
2. Two files the design export failed to deliver were restored from the full project export on 2026-10-18: `sertifikat-full-name.png` (it arrived truncated) and `KidsUp-Brosura.pdf`.
3. Local files are referred to with root-absolute URLs (`/assets/…`), so they also load on a deep path.
4. The application form has a consent checkbox and a collapsible privacy notice under the language buttons (`PrivacyConsent`), and the footer has a link "Məxfilik bildirişi" to it. The design has neither (`SEC-F-16`).
5. The fallback shown when the form cannot be sent is a WhatsApp link with a fixed greeting, labelled "WhatsApp ilə bizə yaz". The design pre-filled the message with the parent's and the children's details (`SEC-F-06`).
6. The child's name and birth-date inputs have `autoComplete="off"`, so a browser never fills in a child's details.
