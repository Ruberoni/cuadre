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

## Hybrid workflow (Design phase stays in Claude Code)

The design-phase skills and agent in `.claude/` (`design-screen`, `sync-design-system`, `design-reviewer`) depend on private Claude Artifacts (`claude.ai/artifact/...`) and Claude-only `design:*` skills. They are intentionally not ported here:

- **Design & token sync** (`/design-screen <n>`, `/sync-design-system`): run in Claude Code.
- **Engineering** (`implement-issue`, `verify`, `plan-reviewer`, `pr-reviewer`, hooks): run in Antigravity with this plugin enabled.

## Managing the plugin

Antigravity discovers `.agents/plugins/cuadre/` automatically when opening this repository (including git worktrees). You can toggle it on or off from Antigravity's **Customizations** view.
