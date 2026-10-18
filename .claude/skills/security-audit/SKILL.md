---
name: security-audit
description: Run the KidsUp security audit across backend, frontend and Docker config: automated scanners plus a review against the mandatory security standards, producing a findings report. Use before a release, after touching forms/API/nginx/Docker/dependencies, or when asked for a security check.
---

# Security audit

Security is **mandatory** here (`back/docs/security-standards.md`, `front/docs/security-standards.md`). This skill produces evidence, not reassurance.

## Step 1: automated checks (all must be clean)

```powershell
# Backend
cd back
.\.venv\Scripts\ruff check . --select S            # bandit rules
.\.venv\Scripts\bandit -q -r app -c pyproject.toml
.\.venv\Scripts\pip-audit --require-hashes -r requirements.txt

# Frontend
cd ..\front
npm run lint                                      # includes no-danger / no-eval / no-console / jsx-no-target-blank
npm audit --audit-level=high
```

Secret scan: search the tree (excluding `node_modules`, `.venv`, `dist`) for obvious secrets and committed env files:
`.env`, `password`, `secret`, `token`, `BEGIN PRIVATE KEY`, real-looking phone numbers. If `gitleaks` is installed run `gitleaks detect`.

## Step 2: running-stack checks

Bring the stack up (`docker-stack` skill) and run:

```powershell
cd front; npm run check:headers
```

Then, in a real browser against the built site, confirm: zero CSP / Trusted Types violations in the console, no third-party host in the network tab
besides those in `front/docs/security-standards.md` §5, and that an injected inline `<script>` is blocked.
If Docker is unavailable say so explicitly and list this step as **not performed**.

## Step 3: standards review

Delegate to the **`security-reviewer`** agent with the scope (changed files, or the whole of `back/app`, `front/src`, `front/nginx`, `docker-compose.yml`, Dockerfiles).
It reports by control id (`SEC-B-NN`, `SEC-F-NN`).

## Step 4: report

Produce: verdict (**BLOCK / FIX BEFORE RELEASE / PASS**), a findings table (severity, control id, `path:line`, fix),
the result of each automated check, the steps **not** performed and why, and the edits needed in the *Compliance status*
tables and *Required before public launch* lists of both security documents. Do not mark a control ✅ without code or test evidence.
