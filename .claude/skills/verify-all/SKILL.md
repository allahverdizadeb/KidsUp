---
name: verify-all
description: Run every quality gate for KidsUp (backend and frontend) and report what passes or fails. Use before declaring any change done, before a commit or PR, and after dependency or config changes. Triggers include "verify", "run all checks", "is it done", "run the gates".
---

# Verify everything

A change is **not done** until every gate below passes. Report results honestly: if anything fails, show the output and
the failing gate; never claim success, never lower a threshold or add an exclusion to make a gate pass.

Run from the repository root (Windows PowerShell shown; use `.venv/bin/…` on Linux/macOS).

## 1. Backend (`back/`): see `back/.claude/skills/verify-backend`

```powershell
cd back
.\.venv\Scripts\ruff check .
.\.venv\Scripts\ruff format --check .
.\.venv\Scripts\mypy
.\.venv\Scripts\bandit -q -r app -c pyproject.toml
.\.venv\Scripts\pip-audit --require-hashes -r requirements.txt
.\.venv\Scripts\python -m pytest          # includes the 80% coverage gate
```

Needs PostgreSQL on `localhost:5432` (user/password `postgres`). If it is not running, start it first and say so.

## 2. Frontend (`front/`): see `front/.claude/skills/verify-frontend`

```powershell
cd front
npm run verify    # typecheck, lint (warnings denied), format:check, test:coverage (80% gate), audit, build
```

## 3. Cross-checks

- If anything served by nginx, the CSP, headers, assets or Docker files changed: bring the stack up (`docker-stack` skill) and run `cd front; npm run check:headers`.
- If an API field, status code or route changed: confirm `back/CLAUDE.md` (the contract owner) and `front/src/api/` agree, and that `Apply.tsx` validation still mirrors the backend schema.
- Search the diff for secrets and personal data (names/phones that look real).

## Report

Give a short table: gate → PASS/FAIL (with the key number: tests passed, coverage %). Mention coverage for both projects
(floor 80%). For failures, state the root cause and the fix; re-run until green or explain what is blocked.
