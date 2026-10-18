# Frontend coding standards

React 19 · TypeScript (strict) · Vite · plain CSS. Read [`security-standards.md`](security-standards.md) first: it wins any conflict.

## 1. Principles

1. **Clarity over cleverness.** Name things so the code reads like the page: `Pricing`, `useReveal`, `submitApplication`.
2. **Components render; hooks hold behaviour; `api/` talks to the network; `content/` holds copy.** Mixing these is the root of most UI bugs.
3. **Derive, don't duplicate.** If a value can be computed from props or state, compute it; do not store it.
4. **Make impossible states impossible**: model status as a union (`'idle' | 'sending' | 'sent' | 'failed'`), not several booleans.
5. **Accessible and secure by default**, never retrofitted ([`styling-and-accessibility-standards.md`](styling-and-accessibility-standards.md), [`security-standards.md`](security-standards.md)).
6. **No speculative code.** No unused props, options or abstractions. Delete dead code.
7. **Comments explain *why*, never *what*.**

## 2. Toolchain (all MUST pass: `npm run verify`)

| Tool | Purpose | Config |
|---|---|---|
| `tsc -b` | Strict type-check of `src/` incl. tests (`strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`) | `tsconfig*.json` |
| `oxlint --deny-warnings` | Lint incl. React hooks rules and the security rules (`no-danger`, `no-eval`, `no-console`, `jsx-no-target-blank`, …) | `.oxlintrc.json` |
| `prettier` | The only formatter: single quotes, 110 columns, trailing commas | `.prettierrc.json` |
| `vitest --coverage` | Tests and the 80% gate | `vite.config.ts` |
| `npm audit` | High/critical dependency vulnerabilities fail the build | `package.json` |

Disabling a lint rule (`// oxlint-disable-next-line rule -- reason`) or using `@ts-expect-error` needs a reason on the same line. `@ts-ignore` and `any` are forbidden.

## 3. Layout

```text
front/
├─ src/
│  ├─ main.tsx             entry: fonts, global CSS, render. Nothing else.
│  ├─ App.tsx              page = sections in order
│  ├─ components/          one component per file + its test (Hero.tsx, Hero.test.tsx)
│  ├─ content/             copy as data (modules, faq, lessons). Edit text here.
│  ├─ hooks/               useHover, useWidth, useReveal (+ tests)
│  ├─ lib/                 pure helpers with no React (hover.ts)
│  ├─ api/                 the ONLY code that calls back/ (applications.ts)
│  ├─ styles/              hover.css (hand-maintained now)
│  └─ test/                setup.ts, viewport.ts: test helpers only
├─ public/                 static files served as-is (assets/, favicon)
├─ nginx/                  production web server + security headers
├─ scripts/                dependency-free tooling (check-security-headers.mjs)
├─ design-source/          read-only design export (one exception, see root CLAUDE.md); never imported
└─ docs/  .claude/
```

Dependency direction: `components → hooks → lib`, `components → api`, `components → content`. `lib` and `api` MUST NOT import React components. Nothing imports from `design-source/` or `test/` (except tests).

## 4. Naming

Names say **what a thing is or does**, in full words. No abbreviations except `id`, `url`, `api`, `ref`, `props`, `ui`. No `data`, `info`, `item`, `temp`, `handle` alone.

| Thing | Convention | Good | Bad |
|---|---|---|---|
| Component file and function | `PascalCase`, noun, file name = component name, **default export, one per file** | `Pricing.tsx` → `export default function Pricing()` | `pricing.tsx`, `PricingSection2.tsx` |
| Hook | `useCamelCase` verb-ish, file name = hook name | `useReveal.ts`, `useWidth.ts` | `reveal.ts`, `useStuff.ts` |
| Non-component module | `camelCase.ts`, named exports | `hover.ts`, `applications.ts` | `Hover.ts`, `utils.ts`, `helpers.ts` |
| Test | `<Subject>.test.ts(x)` next to the subject | `Apply.test.tsx` | `apply-spec.tsx`, `tests/Apply.tsx` |
| Variable / function | `camelCase`; functions are **verb phrases** | `submitApplication`, `ageAtStart` | `application`, `doIt` |
| Boolean | `is` / `has` / `can` / `should` prefix | `isMobile`, `hasError`, `canAddChild` | `mobile`, `error` (when boolean) |
| Event handler (local function) | `handle` + Event | `handleSubmit`, `handleLanguageToggle` | `submit`, `onClickFn` |
| Event handler prop | `on` + Event | `onSelect`, `onClose` | `selectHandler` |
| Constant | `UPPER_SNAKE_CASE`, module level | `PROGRAM_START`, `REQUEST_TIMEOUT_MS` | `programStart`, magic numbers inline |
| Type / interface | `PascalCase`, **no `I`/`T` prefix**; props type is `<Component>Props` | `ApplicationPayload`, `ModuleIconProps` | `IPayload`, `TProps` |
| Union instead of enum | string literal union | `type Status = 'idle' \| 'sending'` | `enum Status` |
| Generic parameter | `T` or descriptive | `T`, `TItem` | `Type1` |
| Context / provider | `<Thing>Context`, `<Thing>Provider` | `AuthContext` | `Ctx` |
| CSS class | `kebab-case`, describes meaning | `cert-dialog` | `box1`, `redText` |
| Content key | camelCase noun | `faqItems`, `lessonStages` | `arr1` |
| Env variable | `VITE_` + `UPPER_SNAKE` (**public by definition**) | `VITE_API_URL` | `API_KEY` (never expose secrets) |
| Test title | behaviour sentence | `'closes with Escape and returns focus'` | `'works'`, `'test 1'` |
| Branch / commit | as in the backend (`feat/…`, Conventional Commits) | `fix(apply): keep errors aligned after removing a child` | `fix`, `wip` |

### Legacy names (debt, do not copy)

The section components were ported from the design tool's runtime and still contain its terse "view-model" names.
These are **known debt, not a precedent**:

- Counters and flags such as `ls0…ls7`, `pj0…pj3`, `qz_`, `qz0…qz2`, `lsWide`, `lsNarrow`, `lsCols`, `pjCols`
- Form fields such as `eParent`, `eParentOn`, `eParentInv`, `eParentB`, `kids[].eName`, `kids[].nameB`
- Hover ids/keys such as `h0…h3`, `k1…k6`, `i2…i6`, `b1`, `hv.h1box`, and generated CSS classes `hv-N`, `fc-N`

Rules: new code MUST follow §4. When you touch one of these files, **rename what you touch** (the tests are the safety net) and
prefer real structures: arrays and maps instead of `ls0…ls7`, a `status` union instead of parallel booleans, descriptive keys
instead of `h1box`. Never add a new name in the legacy style.

## 5. TypeScript

- `strict` is on and stays on. No `any`, no non-null `!` (except `document.getElementById('root')!` in `main.tsx`), no unchecked `as` casts. Prefer type guards and `satisfies`.
- Exported functions have **explicit return types**; locals are inferred.
- Use `type` for shapes and unions, `interface` only when extending is the point. `readonly`/`as const` for data that must not change.
- Data from outside (API responses, `localStorage`, URL) is `unknown` until **validated** (`SEC-F-08`); never trusted by a cast.
- Imports: external, then absolute-from-`src` / relative, then styles; type-only imports use `import type`. No barrel files that hide dependency direction.

## 6. React

- **Function components and hooks only.** Hooks are called unconditionally at the top level (`react/rules-of-hooks` is an error).
- State lives as low as possible. Lift only when two siblings need it. Do not mirror props into state.
- `useEffect` is for synchronising with the outside world (DOM listeners, timers, observers). **Every effect that subscribes MUST clean up**; effects that can be replaced by an event handler or a derived value MUST be.
- Dependency arrays are complete; do not suppress `exhaustive-deps`. When an effect must read the latest value without restarting, store it in a ref updated in an effect (see `Footer`).
- **Keys** are stable ids, never array indexes for lists that change. (Static, never-reordered lists may use the index.)
- No `dangerouslySetInnerHTML`, no direct DOM mutation except through refs inside effects (scroll/animation/focus), no `document.querySelector` in render.
- Do not memoise (`useMemo`/`useCallback`/`memo`) without a measured need; React 19 compiles most of it away.
- A component SHOULD stay under ~200 lines of logic. Illustrations (SVG) are data-heavy: extract them into their own component when they obscure behaviour.
- Components never call `fetch`. They call a function from `src/api/`, which owns URLs, headers, timeouts and error mapping.

## 7. Copy, locale and content

- All user-facing text is **Azerbaijani**; identifiers, comments and commit messages are English.
- Copy that is data (lists, FAQs, timelines) lives in `src/content/`; short one-off labels may stay in JSX.
- Dates, numbers and prices are formatted consistently (`1 150 AZN`, `5 dekabr 2026`). Never concatenate translated fragments into sentences when word order can change.
- Keep `<html lang="az">` and mark any foreign-language snippet with `lang`.

## 8. Errors

- Network and validation failures are **handled where the user is told about them** (`Apply`), with a message that helps and never reveals internals (`SEC-F-14`).
- A render error in one section MUST NOT blank the page: the app is wrapped in `ErrorBoundary` (`src/components/ErrorBoundary.tsx`), which shows a fallback with no error text and the contact options.
- `console.*` is forbidden (lint). Report errors through the error boundary / a monitoring hook, never with data.

## 9. Performance

- Budget: initial JS ≤ 150 kB gzip (currently ~105 kB), total transferred on first load ≤ 400 kB excluding images, LCP < 2.5 s on a mid-range phone.
- Images have `width`/`height`, `alt`, and `loading="lazy"` below the fold; fonts are self-hosted with `font-display: swap`.
- Code-split anything large and rarely used (the certificate dialog is a candidate). Measure before optimising.

## 10. Dependencies

- Dependencies are **few and justified**. Prefer the platform (`fetch`, `IntersectionObserver`, `AbortSignal.timeout`) over a library. Today the only runtime dependencies are `react`, `react-dom` and the self-hosted font.
- `package-lock.json` is committed; installs use `npm ci`. Adding a dependency needs: active maintenance, compatible licence, no `npm audit` findings, bundle-size check, and a stated reason in the PR.
- Upgrade at least monthly and immediately for security advisories.

## 11. Review checklist

A reviewer (human or the `frontend-reviewer` agent) rejects the change if any answer is "no":

- [ ] Names follow §4 and the change added no legacy-style names?
- [ ] Layering respected (no `fetch` in components, no React in `lib`/`api`)?
- [ ] No `any`, no unchecked casts, no suppressed lint rules without a reason?
- [ ] Effects clean up; no derived state stored; keys correct?
- [ ] Every user-facing string is Azerbaijani and correct?
- [ ] Accessible by keyboard and screen reader; passes the axe test?
- [ ] Meets every applicable control in [`security-standards.md`](security-standards.md)?
- [ ] Tests added for behaviour and security-relevant paths, coverage still ≥ 80% (see [`testing-standards.md`](testing-standards.md))?
