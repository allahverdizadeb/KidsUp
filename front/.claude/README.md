# Claude Code configuration: frontend

Scope: `front/` only. Cross-project skills/agents are in [`../../.claude`](../../.claude/README.md). The chain of responsibility applies:
these project skills and agents decide first, then the root ones. Binding rules are in [`../docs`](../docs/README.md).

| Kind | Name | Use |
|---|---|---|
| Agent (read-only) | [`frontend-reviewer`](agents/frontend-reviewer.md) | Review UI changes: naming, layering, accessibility, security, 80% gate |
| Skill | [`verify-frontend`](skills/verify-frontend/SKILL.md) | Run `npm run verify` and report |
| Skill | [`new-component`](skills/new-component/SKILL.md) | Add a component/hook with its test, to standard |
| Skill | [`add-api-call`](skills/add-api-call/SKILL.md) | Add a backend call in `src/api` safely |
