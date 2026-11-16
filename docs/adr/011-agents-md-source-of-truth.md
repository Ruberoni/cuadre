# ADR-011: AGENTS.md as agent source of truth

**Status:** Accepted

## Context
Several agent tools may work on this repo (Claude Code primarily, also Codex or Cursor). Long instruction files get ignored; rules that can be checked mechanically are more reliable in tooling.

## Decision
- Root `AGENTS.md` is the single source of agent instructions, kept short (~150 lines). `CLAUDE.md` only contains `@AGENTS.md`.
- Each module has its own `AGENTS.md` with local rules.
- Any rule that can be verified (types, lint, boundaries, tests) is enforced by tooling in CI rather than written as prose.
- Claude Code hooks: format and lint each edited file with Biome; typecheck before the agent finishes.
- Project skills are added only after a pattern has repeated 2–3 times. Initial skills: `implement-issue`, `sync-design-system`.

## Consequences
- Tool-agnostic instructions.
- Discipline needed to keep `AGENTS.md` short.
