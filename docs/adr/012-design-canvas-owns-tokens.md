# ADR-012: Design System owns the tokens; screens are designed before they are built

**Status:** Accepted (amended 2026-11-16, 2026-11-17, 2026-11-18)

## Context
The UI is designed in Claude artifacts: drafted by an agent with the `design-screen` skill and approved by the maintainer. If both the design and the code define tokens, they drift. Agents left without a visual reference invent UI, and each one invents it differently.

## Decision
- Two artifacts:
  - **Cuadre Design System** (Claude "Design System" artifact): source of truth for design tokens (color, typography, spacing, radius), component specs and the formatting guide.
  - **Cuadre Screens** (Claude "Design" artifact, built on the Design System): one artboard per screen.
- `apps/web` mirrors the tokens (shadcn CSS variables + Tailwind theme) through an explicit sync step, done by a `sync-design-system` project skill that opens a PR. Component code comes from the shadcn CLI; only tokens are synced.
- **Design is a required step, gated at two levels:**
  1. No UI code, including the walking skeleton, is written before the Design System exists and the *App shell* and *Products* artboards exist. The first step of the walking skeleton syncs the tokens into `apps/web`, before any UI code.
  2. An issue that adds or changes a screen cannot be marked `agent-ready` until its **Design handoff** field holds the artboard link, a completed review checklist and the handoff. Until then it carries `needs-design`. Issues without UI state `N/A — no UI`.
- **Every design goes through the review flow** in [`docs/design/README.md`](../design/README.md), using the `design` plugin skills. Each screen gets `/ux-copy` → `/design-critique` → `/accessibility-review` → `/design-handoff`. The Design System gets `/design-system extend` per component, `/accessibility-review` on tokens, and `/design-system audit` before each sync. No open critical findings pass a step.
- The evidence lives in the issue, not in per-screen files: the handoff is a snapshot for the implementer, while the artifacts stay the living reference. Only reusable outputs go to the repo (error messages, glossary terms).
- Desktop only (minimum 1280 px). Accessibility target WCAG 2.2 AA, with 24×24 px pointer targets. Exception: SC 1.4.10 Reflow (content reflowing at 320 CSS px) cannot be met by a desktop-only layout; it is accepted until responsive layouts are built.
- **Screens are drafted by the `design-screen` project skill (`/design-screen <n>`).** It asks the product questions, draws the artboards in Cuadre Screens, runs the review flow (with a `design-reviewer` agent for critique and accessibility) and writes the Design handoff into the issue. **The agent proposes; the maintainer approves** the artboards and the handoff and applies `agent-ready` themselves: the skill never adds or removes labels. **The Design System only grows:** the skill may add components, CSS classes and tokens, never change or remove an existing one; a change to what exists is the maintainer's decision, so the skill stops and asks. Added tokens reach `apps/web` through the `sync-design-system` PR the skill ends with.
- Tokens use semantic names. The MVP ships a light theme only.
- Visual tone: sober and information-dense (compact tables, one sans-serif font, a single accent color). Numbers, currencies and dates follow `es-VE` conventions.

## Consequences
- Agents implement against a visual reference instead of inventing UI.
- Token changes require a sync PR; editing tokens directly in code is not allowed.
- UI slices wait on the maintainer's approval of the drafted design; screens are designed just in time, one slice ahead.
- Dark mode is added later by giving the semantic tokens dark values.
- The review skills exist only in the maintainer's Claude setup; agents in other tools rely on the handoff in the issue, which they read through `gh`.
