---
name: verify-backend
description: Run every backend gate (ruff lint and format, mypy strict, bandit, pip-audit, pytest with the 80% coverage gate) and report results. Use after any change in back/ and before declaring backend work done.
---

# Verify the backend

Definition of done for `back/` (see `back/docs/README.md`). Run from `back/` with the virtualenv (Windows PowerShell; Linux/macOS use `.venv/bin/…`):

```powershell
.\.venv\Scripts\ruff check .                                   # lint incl. bandit "S" rules
.\.venv\Scripts\ruff format --check .                          # formatting (fix with: ruff format .)
.\.venv\Scripts\mypy                                           # strict typing of app/ and tests/
.\.venv\Scripts\bandit -q -r app -c pyproject.toml             # no output = clean
.\.venv\Scripts\pip-audit --require-hashes -r requirements.txt # known vulnerabilities in the locked deps
.\.venv\Scripts\python -m pytest                               # tests + coverage; fails under 80%
```

## Notes

- **PostgreSQL must be running** on `localhost:5432` (user/password `postgres`). The suite creates `kidsup_test` itself. Never switch tests to SQLite.
- First time or after dependency changes: `pip install --require-hashes -r requirements-dev.txt`. To change dependencies edit `requirements.in` / `requirements-dev.in`, then regenerate the locks:
  `uv pip compile requirements.in --universal --generate-hashes --no-header -o requirements.txt` and
  `uv pip compile requirements-dev.in -c requirements.txt --universal --generate-hashes --no-header -o requirements-dev.txt`.
- Never lower `--cov-fail-under`, add `# pragma: no cover`, or blanket-`noqa` to pass. Fix the code or the test.

## Report

Table of gate → PASS/FAIL; tests passed/total; coverage % (floor 80%, expect ~100% here). For a failure give the root cause and fix, then re-run. If PostgreSQL is not available say the suite was **not run**.
