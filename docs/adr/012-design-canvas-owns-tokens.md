# ADR-012: Design System owns the tokens; screens are designed before they are built

**Status:** Accepted (amended 2026-11-16)

## Context
The maintainer designs the UI in Claude artifacts. If both the design and the code define tokens, they drift. Agents left without a visual reference invent UI, and each one invents it differently.

## Decision
- Two artifacts:
  - **Cuadre Design System** (Claude "Design System" artifact): source of truth for design tokens (color, typography, spacing, radius), component specs and the formatting guide.
  - **Cuadre Screens** (Claude "Design" artifact, built on the Design System): one artboard per screen.
- `packages/ui` mirrors the tokens (shadcn CSS variables + Tailwind theme) through an explicit sync step, done by a `sync-design-system` project skill that opens a PR. Component code comes from the shadcn CLI; only tokens are synced.
- **Design is a required step, gated at two levels:**
  1. No UI code, including the walking skeleton, is written before the Design System exists, the *App shell* and *Products* artboards exist, and the tokens are synced.
  2. An issue that adds or changes a screen cannot be marked `agent-ready` until its **Design** field links the artboard. Until then it carries `needs-design`. Issues without UI state `N/A — no UI`.
- Tokens use semantic names. The MVP ships a light theme only.
- Visual tone: sober and information-dense (compact tables, one sans-serif font, a single accent color). Numbers, currencies and dates follow `es-VE` conventions.

## Consequences
- Agents implement against a visual reference instead of inventing UI.
- Token changes require a sync PR; editing tokens directly in code is not allowed.
- UI slices wait on the maintainer's design work; screens are designed just in time, one slice ahead.
- Dark mode is added later by giving the semantic tokens dark values.
