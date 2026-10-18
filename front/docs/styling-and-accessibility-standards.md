# Styling and accessibility standards

> **WCAG 2.2 level AA is mandatory.** Children's families include people with visual, motor and cognitive
> disabilities and people on small phones and slow connections. Accessibility is a release blocker, not polish.

## 1. Design tokens (source of truth)

These come from the approved design and are used as literal values in the ported components. New code MUST use these
exact values (or move them to CSS custom properties when the styling approach is refactored; see §3).

| Token | Value | Use |
|---|---|---|
| Brand pink | `#FF0083` | Accent, large headings words, primary buttons |
| Brand pink, hover | `#E00073` (buttons) / `#D6006E` (links) | Hover/active states |
| Ink | `#1A1A1A` | Body text, borders, dark surfaces |
| Ink, secondary | `#4A4A4A` | Paragraph text |
| Ink, muted | `#6B6B6B` | Captions, hints (minimum on `#F6F6F6`: 4.93:1) |
| Surface | `#F6F6F6` | Alternating section background |
| White | `#FFFFFF` | Page and card background |
| Tint | `#FFF0F7`, `#FFD1E8` | Highlight boxes, focus ring glow |
| Error | `#B00060` | Error text and borders (6.97:1 on white) |
| Font | Manrope Variable, weights 400–800, self-hosted | Everything. Inputs and buttons use `font-family: inherit` |
| Radii | `6px` controls and cards, `4px` small chips | |
| Header | fixed, `72px` tall (`padding-top: 73px` on the page, `scroll-padding-top: 96px`) | |
| Container | `max-width: 1360px`, side padding `clamp(20px, 4vw, 32px)` | |

Fluid type uses `clamp()`: hero `clamp(46px, 8.2vw, 120px)`, section headings `clamp(34px, 4.6vw, 60px)`. Body text is never below 15px (secondary captions 14px at minimum).

## 2. Responsive behaviour

- Mobile first. The design is verified at **390 px** and **1440 px**; every change MUST be checked at both and at 700, 900 and 1240 px where layout switches happen.
- Breakpoints in code (`useWidth`): `< 700` two-column steps and compact lists · `< 900` lesson timeline becomes a start-time grid · `< 1240` header collapses into the menu button. New breakpoints need a reason and an entry here.
- **No horizontal page scroll at any width** (the page uses `overflow-x: clip`). Test with a 320 px viewport.
- Text may be zoomed to 200% and spaced per WCAG 1.4.12 without loss of content. Do not fix heights on text containers.

## 3. How styles are written

- Components use **inline style objects** exactly as ported from the design (this is what makes the result pixel-identical to it). Static values stay literal; computed values come from state or props.
- Pseudo-state styles (`:hover`, `:focus`) live in `src/styles/hover.css`. It was generated once from the design and is **now hand-maintained source**. Rules carry `!important` because inline styles would otherwise win. Prefer meaningful class names for new rules; the generated `hv-N` / `fc-N` names are legacy debt (see [`coding-standards.md` §4](coding-standards.md#legacy-names-debt-do-not-copy)).
- Global CSS is limited to `src/index.css`: reset, body, focus ring, keyframes, reduced-motion. Do not add component styling there.
- **Do not mix a shorthand with its longhands in one style object** (`textDecoration` + `textDecorationColor`): React warns and updates break. Use the longhand set (`textDecorationLine`, …).
- Styling that can be a layout (flex/grid/`clamp`) MUST NOT be a pixel-perfect hack. No `!important` outside `hover.css`.
- A future refactor to CSS custom properties or CSS modules is welcome if the pixel comparison against the design stays at 0% difference.

## 4. Accessibility requirements (WCAG 2.2 AA, all mandatory)

**Structure and semantics**
- One `<h1>`; headings descend without skipping levels; landmarks (`header`, `nav`, `main` content in `section`s with ids, `footer`) are real elements. Lists are `ul`/`ol`; buttons are `<button>`, links are `<a href>`. Never a clickable `<div>`.
- `<html lang="az">`; foreign text gets `lang`.
- Every image has meaningful `alt` (decorative SVG illustrations are `aria-hidden` or carry a descriptive `role="img"` + `aria-label`, as in the design).

**Operable**
- **Everything works with the keyboard alone**, in a logical order, with a **visible focus indicator** (`:focus-visible` 3 px pink outline, never removed). Dialogs trap focus, close with `Escape`, and **return focus** to the trigger (`Certificate`).
- **Target size ≥ 24×24 CSS px (WCAG 2.2) and ≥ 44×44 for primary controls** (the design uses 44–60 px).
- No time limits; no content that flashes; moving content that lasts > 5 s has a **pause control** (the footer rocket has one).
- Respect `prefers-reduced-motion`: animations and transitions are disabled globally; movement effects in `hover.ts` are skipped.
- Hover must never be the only way to reach information (touch/pen users get no hover; the design only decorates).

**Understandable**
- Every form field has a visible `<label for>`; errors are text (not colour alone), linked with `aria-describedby`/`aria-invalid`, announced (`role="alert"`), and focus moves to the first invalid field.
- Instructions and formats are stated before input (phone example, language hint). Autocomplete tokens are set per `SEC-F-06`.
- State is exposed to assistive tech: `aria-expanded`, `aria-pressed`, `aria-current="step"`, `aria-live="polite"` for dynamic regions, `aria-modal` on dialogs. ARIA state props are **booleans or the exact token**, never arbitrary strings.

**Perceivable**
- **Contrast:** text ≥ **4.5:1** (≥ 3:1 only for *large* text: ≥ 24 px, or ≥ 18.66 px bold) and UI components/graphics ≥ 3:1. Colour is never the only carrier of meaning.
- Content reflows and remains usable at 320 px width and 200% zoom. Do not disable zoom (`maximum-scale`).

## 5. Verification

| Check | How | When |
|---|---|---|
| Automated structure/ARIA | `src/App.a11y.test.tsx` runs **axe-core** (WCAG 2 A/AA, 2.1 AA, 2.2 AA, best practices) on desktop and mobile; **must report zero violations** | every `npm run verify` |
| Component behaviour | Testing Library queries by role/name prove labels, focus management, keyboard paths | unit tests |
| Contrast | Computed from tokens (§6). jsdom has no layout, so axe's contrast rule is off in tests | on any colour change; before release |
| Screen reader + keyboard pass | NVDA/VoiceOver walk-through of header → form submit; keyboard-only tab order | before each release |
| Zoom/reflow | 200% zoom and 320 px viewport, no loss, no horizontal scroll | before each release |

## 6. Known gaps (verified 2026-10-12)

| ID | Gap | Detail | Owner decision needed |
|---|---|---|---|
| A11Y-1 | **Brand pink fails AA for normal-size text** | `#FF0083` on white is **3.76:1**, on `#F6F6F6` **3.48:1**, on tint `#FFF0F7` **3.42:1**; white on `#FF0083` is **3.76:1**. Passes only as *large text*. Affected: small pink eyebrow labels (15 px bold, e.g. "Uşaqlar nə öyrənəcək?"), small pink numerals/dashes, 16 px white-on-pink buttons (header "Müraciət et"), pink caption text | Use `#D6006E` (**5.14:1** on white, **5.14:1** white-on-pink) for any text under 18.66 px bold and for buttons smaller than that, keep `#FF0083` for large headings, shapes and illustrations. Needs design approval because it changes the approved look |
| A11Y-2 | Colour contrast is not machine-checked in CI | axe's rule needs real layout | Add a Playwright + axe run against the built page (also covers `SEC-F-15`) |
| A11Y-3 | No manual screen-reader audit recorded | | Do before launch and record the result here |
| A11Y-4 | The brochure PDF has no text layer (verified 2026-10-18) | `public/assets/KidsUp-Brosura.pdf` is two full-page images with no fonts or text: screen readers read nothing, text cannot be selected or searched, and the WhatsApp address is not a link. Every fact in it is also on the page, so no one is left without the information | Ask for a text-based export of `KidsUp Brosura.dc.html` (real text, tagged PDF, document language `az`, clickable links) and replace the file; `publicAssets.test.tsx` keeps checking its page count and size |

Verified OK: ink `#1A1A1A` on white 17.4:1 · secondary `#4A4A4A` 8.86:1 · muted `#6B6B6B` 5.33:1 (white) / 4.93:1 (surface) · error `#B00060` 6.97:1 (white) / 6.32:1 (tint) · white on dark footer 17.4:1 · pink on the dark footer 4.62:1 · white on hover pink `#E00073` 4.75:1.

## 7. Review checklist

- [ ] Works with keyboard only; focus visible; focus order logical; dialogs trap and restore focus?
- [ ] Every control has an accessible name; ARIA state props are correct; no clickable `div`s?
- [ ] New colours meet §4 contrast (compute them); no new pink small text without an approved fix for A11Y-1?
- [ ] Layout verified at 320, 390, 700, 900, 1240 and 1440 px; no horizontal scroll; 200% zoom OK?
- [ ] Motion respects `prefers-reduced-motion` and has a pause control if it runs > 5 s?
- [ ] axe test still has zero violations?
