# ADR-012: Design System canvas owns the tokens

**Status:** Accepted

## Context
The maintainer keeps a Design System canvas (a Claude design artifact) for the UI. If both the canvas and the code define tokens, they drift.

## Decision
- The canvas is the source of truth for design tokens (color, typography, spacing, radius) and component specs.
- `packages/ui` mirrors them (shadcn CSS variables + Tailwind theme) through an explicit sync step, done by a `sync-design-system` project skill that opens a PR.
- Every **new screen** gets a design in the canvas before its issue is marked `agent-ready`; the issue links it in its **Design** section.
- Visual tone: sober and information-dense (compact tables, one sans-serif font, a single accent color).

## Consequences
- Agents implement against a visual reference instead of inventing UI.
- Token changes require a sync PR; editing tokens directly in code is not allowed.
