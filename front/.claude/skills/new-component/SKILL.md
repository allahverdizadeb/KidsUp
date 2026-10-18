---
name: new-component
description: Create a new React component (page section, widget, hook or dialog) for the KidsUp frontend following the naming, layering, accessibility, security and testing standards, with its test file. Use whenever a component or hook is added in front/src.
---

# Add a component

Read `front/docs/coding-standards.md` (§3–6), `front/docs/styling-and-accessibility-standards.md` and `front/docs/security-standards.md` first.

## Decide

- **Is it a component or a hook?** Rendering → component (`PascalCase.tsx`, **default export**, one per file, name = file name). Reusable behaviour → hook (`useThing.ts`, named export) in `src/hooks/`. Pure logic → `src/lib/` (no React).
- **Where does its text come from?** Lists/FAQs/timelines go to `src/content/<name>.ts`; all visible text is **Azerbaijani**.
- **Does it touch the network or personal data?** Then it calls a function from `src/api/` (never `fetch` in a component) and falls under `SEC-F-06/07/08/16`.

## Build

1. **Names:** descriptive full words; booleans `is/has/can/should`; handlers `handleSomething`, handler props `onSomething`; props type `<Component>Props`; **never** the legacy style (`ls0`, `qz_`, `eNameOn`, `h1box`).
2. **Structure:** state as low as possible; derive instead of duplicating; status as a union (`'idle' | 'sending' | …`); effects only for syncing with the outside world and **always cleaned up**; stable keys.
3. **Markup:** real elements (`button`, `a`, `ul`, `label for`), one `h1` per page, headings in order, `alt` on images, `aria-*` state props as booleans/exact tokens, visible focus (never remove the outline), targets ≥ 44px for primary controls, respect `prefers-reduced-motion` and give any motion > 5 s a pause control.
4. **Security:** no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; external links `target="_blank" rel="noopener noreferrer"` to static HTTPS URLs; no new third-party resource (the CSP would block it); nothing personal in storage/URL/console.
5. **Style:** follow the design tokens in `styling-and-accessibility-standards.md` §1. Compute contrast for any new colour (≥ 4.5:1 for normal text; the brand pink `#FF0083` fails for small text: use `#D6006E` or keep it for large/decorative use). Mind the mixed `textDecoration` shorthand/longhand trap.
6. **Register it** in `src/App.tsx` (page order) if it is a section, with a stable `id` for the nav.

## Test (same change)

Create `<Component>.test.tsx` next to it: render it, query by role/label, interact with `userEvent`, assert visible outcomes. Cover keyboard use, each state, error paths and every branch; mock only `src/api/`; fake timers for time; fake data. Behaviour-sentence test names. Security-relevant code 100% covered. The page-level axe test must still report zero violations.

## Finish

Run the `verify-frontend` skill (coverage ≥ 80%), then the `frontend-reviewer` agent. If markup/style changed, compare against `design-source/` at 390 and 1440 px.
