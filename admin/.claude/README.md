# Claude Code configuration: admin panel

Scope: `admin/` only. Cross-project skills/agents are in [`../../.claude`](../../.claude/README.md). The chain of responsibility applies:
these project skills and agents decide first, then the root ones. Binding rules are in [`../docs`](../docs/README.md) and the frontend's [`../../front/docs`](../../front/docs/README.md).

| Kind | Name | Use |
|---|---|---|
| Skill | [`verify-admin`](skills/verify-admin/SKILL.md) | Run `npm run verify` and report |

For reviews use the root agents `security-reviewer` and `standards-reviewer` (they cover `admin/` too) and, for UI code, the frontend's `frontend-reviewer`
with `admin/docs/README.md` and `admin/CLAUDE.md` as the added rules.
