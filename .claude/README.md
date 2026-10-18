# Claude Code configuration (root level)

Skills and agents here apply to the **whole repository**. Project-specific ones live next to their project:

| Location | Scope |
|---|---|
| `.claude/` (this folder) | Cross-project work: full verification, security audits, the Docker stack, features that span `front/` and `back/` |
| `front/.claude/` | Frontend only |
| `back/.claude/` | Backend only |

Follow the **chain of responsibility** from [`../CLAUDE.md`](../CLAUDE.md): the most specific folder decides first, then it defers upward.

## Agents (`agents/`)

| Agent | Purpose | Edits files? |
|---|---|---|
| [`security-reviewer`](agents/security-reviewer.md) | Reviews code/config against **both** security standards and reports findings by control id (`SEC-B-NN`, `SEC-F-NN`) | No (read-only) |
| [`standards-reviewer`](agents/standards-reviewer.md) | Reviews naming, layering, tests and coverage against the coding and testing standards | No (read-only) |

## Skills (`skills/`)

| Skill | Use it when |
|---|---|
| [`verify-all`](skills/verify-all/SKILL.md) | Before saying any change is done: runs every back and front gate |
| [`security-audit`](skills/security-audit/SKILL.md) | Before a release or after touching anything security-relevant |
| [`docker-stack`](skills/docker-stack/SKILL.md) | Starting, checking or resetting the Docker stack |
| [`cross-stack-feature`](skills/cross-stack-feature/SKILL.md) | A feature touches the API contract **and** the UI |

Project skills: `verify-backend`, `new-endpoint`, `new-migration` (back) and `verify-frontend`, `new-component`, `add-api-call` (front).
