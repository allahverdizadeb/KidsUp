# Frontend testing standards

Tools: **Vitest** (runner, `jsdom`), **@testing-library/react** + **user-event** + **jest-dom** (behaviour tests), **axe-core** (accessibility), **@vitest/coverage-v8**.

## 1. The coverage gate (mandatory)

- **Project-level coverage MUST be at least 80% on all four metrics: statements, branches, functions and lines.**
- It is enforced automatically: `vite.config.ts` sets `coverage.thresholds` to 80 and `npm run test:coverage` (part of `npm run verify`) **fails** below it. Lowering a threshold, widening `coverage.exclude`, or adding ignore comments to pass the gate is forbidden without an entry in the *Accepted risks* table of [`security-standards.md`](security-standards.md).
- Only `src/main.tsx` (the entry that mounts React) and the test helpers are excluded. Everything else in `src/` counts.
- 80% is a **floor**. Current coverage: statements 98.7%, branches 95.6%, functions 98.8%, lines 99.3%. New or changed code SHOULD be ≥ 90% covered; **security-relevant code (forms, links, `api/`, `ErrorBoundary`, anything touching user data) MUST be covered 100% including failure paths.**
- Coverage shows code *ran*, not that it is *right*. A test without a meaningful assertion does not count; reviewers reject it.

## 2. What to test

| Level | Scope | Examples |
|---|---|---|
| **Unit** | Pure logic and hooks in isolation | `lib/hover.ts`, `useHover`, `useWidth`, `useReveal` |
| **Component (the default)** | A component rendered as a user would see it: roles, labels, text, keyboard, state changes | `Lesson`, `Faq`, `Certificate`, `Apply` |
| **Integration** | The whole `<App />` | Sections present and ordered, one `h1`, images have `alt`, no inline handlers |
| **Accessibility** | axe-core over the full page at desktop and mobile widths, and with the privacy notice open and after an incomplete submit | `App.a11y.test.tsx` (zero violations) |
| **Security** | One check per control in [`security-standards.md`](security-standards.md) | `rel="noopener noreferrer"`, input `maxlength`, request timeout, `ErrorBoundary` leaks nothing, lint rules, `npm run check:headers` |
| **Contract** | The call to the API sends exactly the documented payload | `api/applications.test.ts`, `Apply.test.tsx` |
| **Assets** | Everything under `public/` is a file a person reviewed (SHA-256 list), complete, free of scripts and personal metadata (PNG text chunks, JPEG EXIF/XMP/IPTC/comment segments, PDF author fields and active content, SVG scripts), and what the page says about a file (image size, PDF pages and size) is true | `publicAssets.test.tsx` |
| **Server config** | The nginx files read as text: headers and policies (compared with the same `scripts/expected-headers.json` the live check uses), every location, one endpoint passed to the API and only for POST, the log format, the image's user | `nginxConfig.test.ts`, then `npm run check:headers` live |
| **Content** | The privacy notice has a version the API accepts, and its wording cannot change under an unchanged version (SHA-256 per version) | `privacyNotice.test.ts` |
| **Visual parity** | The page is compared pixel-for-pixel with the approved design (`design-source/`) at 390 px and 1440 px with reduced motion | manual, before changing markup or styles; target 0% difference, except the deliberate differences listed in `../CLAUDE.md` |

Not tested: React internals, CSS values that restate the source, snapshots of large DOM trees (SVG illustrations in particular). **Do not write snapshot tests of components.**

## 3. Writing tests

**Test what a user can see and do, not how the code is built.**

- **Query by accessibility first**: `getByRole(name)` → `getByLabelText` → `getByText` → (last resort) `getByTestId`. If a role/label query cannot find it, a real user cannot either, so fix the component, not the query.
- **Use `userEvent`** for interactions (it fires realistic event sequences); `fireEvent` only for events `userEvent` cannot produce (`change` on `type="date"`, `pointer*`, `submit`, `scroll`). Tests that type or interact many times (the form) create the instance per test with `userEvent.setup({ delay: null })`: by default it waits a timer tick after every keystroke (about 15 ms on Windows), which made the form tests time out when the suite ran in parallel. A lone click may use the direct API.
- **One behaviour per test**, arranged Arrange – Act – Assert. Use `it.each` for the same rule over many inputs.
- **Names are behaviour sentences**: `'closes with Escape, restores scroll and returns focus to what opened it'`. Not `'works'`, `'test 1'`, `'handles click'`. Group with `describe('<Component>')`.
- **Mock only at the boundary** you own: `vi.mock('../api/applications')`. Never mock React, hooks under test, or the component's own children. Do not mock the DOM; jsdom stubs for missing browser APIs live in `src/test/setup.ts` only.
- **Time is controlled**: `vi.useFakeTimers({ toFake: [...] })`, never real `sleep`. Wait for async UI with `findBy…` / `vi.waitFor`, never fixed delays.
- Test data is **obviously fake** (`Aysel`, `+994 50 123 45 67`). No real people, ever.
- Tests are independent and order-free: `cleanup()` runs after every test, global state (body styles, timers, stubs, `matchMedia`) is reset (`afterEach`, `vi.restoreAllMocks`, `vi.unstubAllGlobals`).
- **A flaky test is a bug.** Fix or delete it the same day. Slow tests (the axe scan) get an explicit named timeout, never a retry.
- For every bug fix: write the failing test first, then the fix.

## 4. Layout and naming

- Tests live **next to the code** they cover: `Hero.tsx` → `Hero.test.tsx`; `useReveal.ts` → `useReveal.test.ts`; sections with trivial shared setup MAY share one file (`HoverSections.test.tsx`) but each `describe` names its component.
- Shared helpers go in `src/test/` (`setup.ts`, `viewport.ts`); keep them tiny and typed.
- Test files may use `console` spies for noisy library output only inside the test that needs it, restored afterwards.

## 5. Running

```text
npm test                  # one run, no coverage
npm run test:watch        # watch mode while developing
npm run test:coverage     # run + coverage report + the 80% gate  (open coverage/index.html for detail)
npm run verify            # the full definition of done
```

## 6. Review checklist for tests

- [ ] Would each new test fail if the behaviour or the security control it covers were removed?
- [ ] Queried by role/label, interacted with `userEvent`, asserted visible outcomes?
- [ ] One behaviour per test, behaviour-sentence name, fake data, deterministic time?
- [ ] No snapshot tests, no reliance on test order or leftover state?
- [ ] Coverage still ≥ 80% on every metric, ≥ 90% on the change, 100% on security paths, no new exclusions?
- [ ] axe test still green; `npm run check:headers` run if anything served changed?
