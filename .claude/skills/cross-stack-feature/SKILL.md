---
name: cross-stack-feature
description: Implement a KidsUp feature that touches both the API contract (back) and the UI (front) in the right order, with tests, security review and documentation. Use for any feature that adds or changes an endpoint, a form field or data the UI shows or sends.
---

# Cross-stack feature workflow

Follows the chain of responsibility in the root `CLAUDE.md`: **`back/` owns the API contract; `front/` consumes it.** Never let the UI invent fields.

1. **Clarify** the behaviour and any personal data involved. Ask the owner when a product decision is open (notifications, retention, new fields). New personal-data fields need a stated purpose (`SEC-B-09`).
2. **Contract first (back).** Use `back/.claude/skills/new-endpoint`: schemas with limits, route, service, authorisation and rate-limit decision, migration if the schema changes (`new-migration`). Write the tests first or alongside; security paths 100% covered.
3. **Document the contract** in `back/CLAUDE.md` (the API section). Only there; other files reference it.
4. **Consume it (front).** Use `front/.claude/skills/add-api-call` for the `src/api/` function and `new-component` for UI. Client validation mirrors the server rules exactly (limits, formats); copy is Azerbaijani; accessibility and security standards apply.
5. **Verify** with the `verify-all` skill. If anything served changed, also the `docker-stack` skill and `npm run check:headers`.
6. **Review:** run the `security-reviewer` agent on the change and the `standards-reviewer` agent for naming, layering and tests. Fix findings, do not argue them away.
7. **Update status docs:** the compliance tables and launch-blocker lists in the two `security-standards.md` files if a control's status changed; the status table in the root `CLAUDE.md`.
8. Commit with Conventional Commits (`feat(applications): …`) and cite the `SEC-B/F-NN` controls you touched in the description.

Never ship a front change that depends on a back change that is not merged and tested, and never ship a back contract change that breaks the current front.
