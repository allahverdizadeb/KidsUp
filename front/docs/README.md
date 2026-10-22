# Frontend documentation

The rules for `front/` (React 19, TypeScript, Vite). **Every rule here is binding.**
Words follow RFC 2119: **MUST** / **MUST NOT** are mandatory, **SHOULD** needs a written reason to skip,
**MAY** is optional.

| Document | What it governs |
|---|---|
| [`coding-standards.md`](coding-standards.md) | Layout, naming, TypeScript and React rules, state, errors, dependencies |
| [`styling-and-accessibility-standards.md`](styling-and-accessibility-standards.md) | Design tokens, responsive rules, motion, **WCAG 2.2 AA (mandatory)** |
| [`security-standards.md`](security-standards.md) | **Mandatory, highest level.** Controls `SEC-F-01…`, privacy of children, compliance status |
| [`testing-standards.md`](testing-standards.md) | Test design and the **80% project-level coverage gate** |
| [`privacy-notice-review.md`](privacy-notice-review.md) | How the consent box and privacy notice work, what counsel approved, and what is still the owner's to do (`SEC-F-16`) |

## Precedence

1. [`security-standards.md`](security-standards.md) overrides everything else.
2. These documents refine the root [`../../CLAUDE.md`](../../CLAUDE.md) and [`../CLAUDE.md`](../CLAUDE.md); they do not contradict them.
3. A deviation needs a written, dated entry in the *Accepted risks* table of the relevant document.

## Definition of done (every change)

```text
npm run verify
  = typecheck  &&  lint (warnings denied)  &&  format:check  &&  test:coverage (80% gate)  &&  audit  &&  build
```

After changing nginx config, headers or anything served: also run `npm run check:headers` against the running stack.
Claude Code shortcut: the `verify-frontend` skill in [`../.claude/skills`](../.claude/skills).
