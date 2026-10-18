# Claude Code configuration: backend

Scope: `back/` only. Cross-project skills/agents are in [`../../.claude`](../../.claude/README.md). The chain of responsibility applies:
these project skills and agents decide first, then the root ones. Binding rules are in [`../docs`](../docs/README.md).

| Kind | Name | Use |
|---|---|---|
| Agent (read-only) | [`backend-reviewer`](agents/backend-reviewer.md) | Review API/DB changes: security, layering, naming, tests, 80% gate |
| Skill | [`verify-backend`](skills/verify-backend/SKILL.md) | Run every backend gate and report |
| Skill | [`new-endpoint`](skills/new-endpoint/SKILL.md) | Add an endpoint: security decisions first, then schema → service → router → tests → contract docs |
| Skill | [`new-migration`](skills/new-migration/SKILL.md) | Add and review an Alembic migration safely |
