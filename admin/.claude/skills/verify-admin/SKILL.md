---
name: verify-admin
description: Run every admin-panel gate (typecheck, lint with security rules, prettier, vitest with the 80% coverage gate and the axe accessibility tests, npm audit, build) and report results. Use after any change in admin/ and before declaring admin work done.
---

# Verify the admin panel

Definition of done for `admin/` (see `admin/docs/README.md`). From `admin/`:

```powershell
npm run verify
```

which runs, in order and stopping at the first failure:

| Step | Command | Fails when |
|---|---|---|
| Types | `npm run typecheck` (`tsc -b`) | any type error (strict, incl. tests) |
| Lint | `npm run lint` (`oxlint --deny-warnings`) | any warning/error, including `no-danger`, `no-eval`, `no-console`, `jsx-no-target-blank` |
| Format | `npm run format:check` (`prettier --check .`) | unformatted file (fix with `npm run format`) |
| Tests | `npm run test:coverage` | a test fails, **or coverage < 80% on statements/branches/functions/lines**, or axe reports a violation (`src/a11y.test.tsx`) |
| Audit | `npm run audit` (`npm audit --audit-level=high`) | high/critical advisory |
| Build | `npm run build` | build error |

## When something served or something of the API changed

- The server side: `python -m pytest tests/test_admin_nginx.py tests/test_compose.py` from `back/` (they read `admin/nginx` and `admin/Dockerfile`).
- A change of the API's contract (a field, a code, a permission) is made in `back/` first, then `src/api/types.ts` and `src/lib/errors.ts` here, and `src/test/fakeBackend.ts` must behave as the API does.
- Then, on a throw-away copy of the stack: `powershell -File scripts\verify-stack.ps1` from the repo root, and look at the sign-in, the dashboard and one change in a real browser (1440 and 390 px) with the console open:
  **zero CSP / Trusted Types violations**.

## Rules

- Never lower a coverage threshold, add `coverage.exclude` entries, disable a lint rule without a reason, or delete a failing test to get green.
- A search term, a name, a phone number or an id never goes into an address, a title or a message. Nothing is stored in the browser.
- Keep the look at the design's (`admin/design-source/`) apart from the deliberate differences in `admin/CLAUDE.md`.

## Report

Gate → PASS/FAIL with key numbers (tests passed, the four coverage percentages, audit result). For failures show the root cause and the fix, then re-run.
