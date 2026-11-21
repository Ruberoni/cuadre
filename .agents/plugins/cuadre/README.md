# Cuadre Antigravity Plugin

Workspace plugin that adapts Cuadre's AI-agent engineering workflow (`.claude/`) for **Antigravity** (e.g., Gemini Neon), coexisting with `.claude/` without modifying it or weakening any repository quality gate.

## What is included

- **Skills**
  - `implement-issue`: end-to-end flow from GitHub issue (`agent-ready`) → reviewed plan → TDD implementation → verification → draft PR → `pr-reviewer` → ready PR.
  - `verify`: `pnpm verify` workflow plus live app inspection using Antigravity's `browser` subagent.
- **Subagents**
  - `plan-reviewer`: read-only reviewer for draft implementation plans against `AGENTS.md`, `docs/GLOSSARY.md`, ADRs, and `REVIEW.md`.
  - `pr-reviewer`: read-only reviewer for pull requests against `REVIEW.md`, issue acceptance criteria, and verification claims.
- **Lifecycle hooks** (`hooks.json`)
  - `branch-name` (`PreToolUse` on `run_command`): blocks `git push` / `gh pr create` from unpublished branches that do not match `<type>/<issue>-<slug>`.
  - `biome-file` (`PostToolUse` on `edit_file|write_file`): runs `biome check --write` on edited repo files.
  - `stop-checks` (`Stop`): runs Biome + `turbo run typecheck test:unit` on touched packages (30 s budget, max 3 rounds before escalation).

Project and module rules (`AGENTS.md`, `apps/api/src/auth/AGENTS.md`, `apps/api/src/modules/catalog/AGENTS.md`) are discovered automatically by Antigravity outside this plugin.

## Antigravity-native workflow

Cuadre's workflow is 100% Antigravity-native (ADR-012, amended 2026-11-21): UI issues carry a lightweight Markdown UI spec directly in GitHub Issues, semantic tokens live directly in `apps/web/src/styles/tokens.css`, and visual/accessibility verification runs against the live app via `verify` (`browser` subagent) and `REVIEW.md`.

## Managing the plugin

Antigravity discovers `.agents/plugins/cuadre/` automatically when opening this repository (including git worktrees). You can toggle it on or off from Antigravity's **Customizations** view.
