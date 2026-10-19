---
name: verify-frontend
description: Run every frontend gate (typecheck, lint with security rules, prettier, vitest with the 80% coverage gate and axe accessibility test, npm audit, build) and report results. Use after any change in front/ and before declaring frontend work done.
---

# Verify the frontend

Definition of done for `front/` (see `front/docs/README.md`). From `front/`:

```powershell
npm run verify
```

which runs, in order and stopping at the first failure:

| Step | Command | Fails when |
|---|---|---|
| Types | `npm run typecheck` (`tsc -b`) | any type error (strict, incl. tests) |
| Lint | `npm run lint` (`oxlint --deny-warnings`) | any warning/error, including `no-danger`, `no-eval`, `no-console`, `jsx-no-target-blank` |
| Format | `npm run format:check` (`prettier --check .`) | unformatted file (fix with `npm run format`) |
| Tests | `npm run test:coverage` | a test fails, **or coverage < 80% on statements/branches/functions/lines**, or axe reports a violation |
| Audit | `npm run audit` (`npm audit --audit-level=high`) | high/critical advisory |
| Build | `npm run build` | build error |

## When something served changed

If you touched nginx config, headers, assets, fonts, `index.html`, Dockerfile or any third-party use: bring the stack up (`docker-stack` skill at the repo root) and run
`npm run check:headers`, then load the site in a real browser and confirm **zero CSP / Trusted Types violations** in the console and no unexpected third-party hosts.

## Rules

- Never lower a coverage threshold, add `coverage.exclude` entries, disable a lint rule without a reason, or delete a failing test to get green. Fix the code or the test.
- A flaky test is a bug: fix it the same day.
- Markup/style changes: keep the pixel comparison against `design-source/` at 0% (apart from the deliberate differences in `front/CLAUDE.md`) unless the owner approved a design change.

## Report

Gate → PASS/FAIL with key numbers (tests passed, the four coverage percentages, audit result). For failures show the root cause and the fix, then re-run.
