# Backend documentation

The rules for `back/` (Python 3.13, FastAPI, SQLAlchemy 2, PostgreSQL). **Every rule here is binding.**
Words follow RFC 2119: **MUST** / **MUST NOT** are mandatory, **SHOULD** needs a written reason to skip,
**MAY** is optional.

| Document | What it governs |
|---|---|
| [`coding-standards.md`](coding-standards.md) | Project layout, layering, naming, typing, errors, logging, dependencies |
| [`api-and-database-standards.md`](api-and-database-standards.md) | REST contract rules, schema design, migrations |
| [`security-standards.md`](security-standards.md) | **Mandatory, highest level.** Controls `SEC-B-01…`, privacy of minors, compliance status |
| [`testing-standards.md`](testing-standards.md) | Test design and the **80% project-level coverage gate** |

## Precedence

1. [`security-standards.md`](security-standards.md) overrides everything else. If a rule here conflicts with it, security wins.
2. These documents refine the root [`../../CLAUDE.md`](../../CLAUDE.md) and [`../CLAUDE.md`](../CLAUDE.md); they do not contradict them.
3. A deviation needs a written, dated entry in the *Accepted risks* table of the relevant document.

## Definition of done (every change)

```text
ruff check .  &&  ruff format --check .  &&  mypy  &&  bandit -q -r app -c pyproject.toml
pip-audit --require-hashes -r requirements.txt  &&  python -m pytest      # pytest enforces the 80% gate
```

Claude Code shortcut: the `verify-backend` skill in [`../.claude/skills`](../.claude/skills) runs exactly this.
