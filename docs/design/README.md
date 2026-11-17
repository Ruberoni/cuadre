# Design flow

How screens and components are designed before they are built. The rule is in [ADR-012](../adr/012-design-canvas-owns-tokens.md); this file is the checklist.

Designs live in two Claude artifacts: **Cuadre Design System** (tokens, component specs, guides) and **Cuadre Screens** (one artboard per screen). The steps below use the skills of the `design` plugin (`/design-system`, `/ux-copy`, `/design-critique`, `/accessibility-review`, `/design-handoff`). Whoever designs runs them; implementing agents only read the result in the issue.

## Ground rules

- **Desktop only.** Minimum viewport 1280 px. No mobile or tablet layouts, no motion beyond shadcn's default transitions.
- **Accessibility target: WCAG 2.2 AA.** Text contrast ≥ 4.5:1 (≥ 3:1 for large text), UI components and focus ring ≥ 3:1, visible focus, everything operable by keyboard, every input labelled. Pointer targets ≥ **24×24 px** (2.5.8). The 44×44 rule (2.5.5) is AAA and does not apply, so compact density is not a failure.
- **Copy uses the glossary.** UI text takes the Spanish column of [`GLOSSARY.md`](../GLOSSARY.md) (e.g. "Emitir", never "Confirmar" or "Publicar"; "Cobro" for money we receive). A new term goes into the glossary in the same PR that uses it.
- **Exit criteria for every review step:** no open 🔴 findings; every 🟡 is fixed or justified in the handoff; 🟢 is optional.

## Phase 0 — Design System

Once, and again whenever a component is added.

1. `/design-system extend <component>` for each component on the Phase 0 list in [`PLAN.md`](../PLAN.md#design-required-step). Its output becomes that component's spec in the Design System.
2. `/accessibility-review` on the tokens: every text/background pair, borders of inputs, the focus ring.
3. `/design-system audit` before every `sync-design-system` run.

## Per screen

Required for every new or changed screen, before its issue loses `needs-design`.

1. Sketch the artboard in Cuadre Screens.
2. `/ux-copy`: all Spanish copy on the screen. That covers actions, empty states, confirmations for issuing a document (it cannot be undone, ADR-013), and a **message for each error code** the slice can return.
3. `/design-critique`, then fix.
4. `/accessibility-review`, then fix.
5. `/design-handoff`, trimmed to the template below, pasted into the issue's **Design handoff** field.

## Where the output goes

| Output | Destination |
|---|---|
| Handoff (template below) | The issue's **Design handoff** field |
| Error code → message | The single UI message catalog in `apps/web`, added by the implementing PR |
| New terms | `docs/GLOSSARY.md` |
| Accessibility or component conventions | Guides in the Design System |

Nothing else is stored in the repo. The artboard and the Design System are the living reference; the handoff is a snapshot for the implementer.

## Handoff template

```markdown
**Artboard:** <link to the artboard in Cuadre Screens>

- [ ] ux-copy
- [ ] design-critique
- [ ] accessibility-review
- [ ] design-handoff

### Components and states
| Component | Variant | States shown | Notes |
|---|---|---|---|

### Empty / loading / error
- Empty: …
- Loading: …
- Error: … (error code → message)

### Copy
| Element | Text |
|---|---|

### Focus and keyboard
- Tab order: …
- Shortcuts / Enter / Escape: …

### Accepted 🟡 findings
- … — why it stays
```

## Later

A `design-screen` project skill that runs the per-screen steps and drafts the handoff will be created after the third screen has gone through this flow by hand (ADR-011).
