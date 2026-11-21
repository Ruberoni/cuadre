# UI Guidelines & Spec Template

Ground rules and lightweight UI spec format for Cuadre screens. The governing decision is [ADR-012](../adr/012-design-canvas-owns-tokens.md) (amended 2026-11-21).

## Ground rules

- **Desktop only.** Minimum viewport **1280 px**. No mobile or tablet layouts, no motion beyond shadcn's default transitions.
- **Accessibility target: WCAG 2.2 AA.**
  - Text contrast ≥ 4.5:1 (≥ 3:1 for large text); UI component borders and focus ring ≥ 3:1.
  - Visible focus indicator, full keyboard operability, every input labelled.
  - Pointer targets ≥ **24×24 px** (SC 2.5.8). The 44×44 rule (2.5.5) is AAA and does not apply, so compact density is not a failure.
  - **Known exception:** SC 1.4.10 Reflow (320 CSS px) cannot be met by a desktop-only layout; it is accepted until responsive layouts (post-MVP backlog) and is not a review finding.
- **Semantic tokens & shadcn components.** `apps/web/src/styles/tokens.css` is the single source of truth for colors, spacing, sizes, radii, shadows, and typography (light theme only for MVP). Use semantic classes (`bg-primary`, `text-table`, etc.) and shadcn components from `apps/web/src/components/ui/`; never write color literals or Tailwind's default palette (`no-hardcoded-tokens.test.ts` enforces this).
- **Copy uses the glossary.** UI text takes the Spanish column of [`GLOSSARY.md`](../GLOSSARY.md) (e.g. "Emitir", never "Confirmar" or "Publicar"; "Cobro" for money we receive). A new term goes into the glossary in the same PR that uses it.
- **Formatting.** Locale `es-VE` (`1.234,56`), symbols `Bs.` and `$` in UI copy, dates `dd/mm/aaaa`, via `apps/web/src/lib/format` only.
- **Verification.** Visual layout (≥ 1280 px), keyboard/focus order, WCAG 2.2 AA basics, error states, and Spanish glossary copy are checked during `verify` (live browser inspection) and `REVIEW.md` item 8.

## Where the output goes

| Output | Destination |
|---|---|
| UI spec (template below) | The issue's **UI spec (states, copy, errors)** field (`N/A — no UI` when no screen changes) |
| Error code → message | The single UI message catalog in `apps/web`, added by the implementing PR |
| New domain terms | `docs/GLOSSARY.md` |
| New or updated tokens | `apps/web/src/styles/tokens.css` (with usage/contrast comment) |

## UI spec template

Paste into the issue's **UI spec (states, copy, errors)** field (or write `N/A — no UI`):

```markdown
### States
- Empty: …
- Loading: …
- Error: … (error code → Spanish message)

### Key copy (`docs/GLOSSARY.md`)
| Element | Spanish text |
|---|---|

### Focus and keyboard
- Tab order / initial focus: …
- Shortcuts / Enter / Escape: …
```
