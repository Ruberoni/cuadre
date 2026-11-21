# AGENTS.md — Cuadre

Cuadre is an ERP for a small Venezuelan distribution business (single company). It is a personal portfolio project built primarily by AI agents working from GitHub issues. This file is the source of truth for every agent (Claude Code, Codex, Cursor…); `CLAUDE.md` only imports it.

> **Status:** walking skeleton in progress. The monorepo, tooling and CI gates exist; business modules and UI arrive slice by slice. The plan lives in [`docs/PLAN.md`](docs/PLAN.md).

## Read before working

1. [`docs/PLAN.md`](docs/PLAN.md) — scope, MVP flow, build order.
2. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — domain vocabulary. Use these names exactly; never invent synonyms.
3. [`docs/adr/`](docs/adr/) — architecture decisions. If your change contradicts an ADR, stop and ask; do not reopen the debate in code.
4. The `AGENTS.md` inside the module you are touching _(one per module; `catalog` is the template)_.

## Repo map

```
apps/api/                 Hono + @hono/zod-openapi HTTP server hosting all modules
  src/auth/               Better Auth (email + password), the session gate, the role gate (deny by default), the seeded users; cross-cutting, not a module
  src/modules/<module>/
    domain/               entities, value objects, pure rules — NO I/O imports
    application/          use cases, one per file
    infrastructure/       Drizzle tables + repositories owned by this module
    http/                 Hono routes
    index.ts              the ONLY public API of the module
    AGENTS.md             module-local rules
apps/web/                 React SPA (Vite, TanStack Router/Query/Table, shadcn/ui, Tailwind)
  src/components/ui/      shadcn components · src/lib/format: es-VE formatting · src/styles: semantic design tokens (`tokens.css`)
  test/                   hand-written-token scanner, boundary-rule fixtures
packages/contracts/       shared Zod schemas
packages/shared-kernel/   pure domain code shared by api and web (Money, Rate, Result); imports nothing outside the package; uses relative `.ts` imports and `erasableSyntaxOnly`
docs/                     PLAN, GLOSSARY, ADRs
```

Modules (MVP): `catalog`, `partners`, `purchasing`, `inventory`, `sales`, `billing`, `exchange-rates`.

## Commands

Requires Node 26 (`.nvmrc`; `nvm use 26`) and pnpm (`npm i -g pnpm`; the version is pinned in `package.json`).

```bash
pnpm install
docker compose up -d     # Postgres on localhost:5433 (override with POSTGRES_PORT); no .env needed
pnpm db:migrate          # migrate the dev database
pnpm db:seed             # seed it: one user per role + demo data (safe to rerun)
pnpm dev                 # api (http://localhost:3000, GET /health, /openapi.json) + web (http://localhost:5173)
pnpm test                # unit + integration (integration needs Postgres, uses the cuadre_test database)
pnpm test:unit
pnpm test:integration
pnpm test:e2e            # Playwright acceptance tests (starts api + web on the cuadre_e2e database; needs Postgres) + Button browser test (PLAYWRIGHT_CHANNEL=msedge uses an installed browser)
pnpm typecheck
pnpm lint                # Biome + dependency-cruiser (pnpm lint:boundaries)
pnpm verify              # Postgres -> fresh cuadre_e2e -> migrate -> seed -> boot api + web -> smoke E2E (ADR-014); one run at a time per machine
```

Seeded users (test values only, never real passwords): `admin@cuadre.test`, `ventas@cuadre.test`, `compras@cuadre.test`, `almacen@cuadre.test`, password `cuadre-demo-2026`. Every `/api` route except Better Auth's (`/api/auth/*`) needs a session; tests sign in with `apps/api/test/sign-in.ts` (integration) or `apps/web/e2e/support/auth.ts` (E2E).

`docker compose down -v` recreates the database volume (the `cuadre_test` database is created only on a fresh volume; `cuadre_e2e` is created by `db:e2e:prepare`).

Each module declares its Drizzle tables in `src/modules/<module>/infrastructure/*.table.ts` (ADR-004); `drizzle-kit` picks them up from there.

## Design system in `apps/web`

- `apps/web/src/styles/tokens.css` is the single source of truth for Cuadre's semantic design tokens (ADR-012, amended 2026-11-21), with usage and contrast notes inline. Edit `tokens.css` directly when adding or updating a token; UI code uses semantic classes (`bg-primary`), never color literals or Tailwind's default palette (colors, radii and shadows are reset, so only `rounded-sm|md|lg` and `shadow-popover|dialog` exist); `no-hardcoded-tokens.test.ts` in `apps/web` enforces the color rule. Text sizes are not reset yet: Tailwind's `text-sm` and friends still exist next to Cuadre's `text-table`, `text-label`… styles, so prefer the latter on screens.
- Components come from the shadcn CLI, pinned: `pnpm dlx shadcn@4.23.0 add <name>` run **from `apps/web`** (it resolves paths from the cwd; ADR-015). It writes `src/components/ui/<name>.tsx` with `@/…` imports. Fix up afterwards: run `git status` at the repo root and `pnpm install`; rewrite `from "cn"` to `from "@/lib/utils"`; drop any dependency it adds that the component does not import (it adds `cn`) and any `minimumReleaseAgeExclude` it writes to `pnpm-workspace.yaml`; `lucide-react` stays pinned to an older version than the registry's latest, so keep the pin. Replace literal colors, Tailwind's default shadows and `rounded-xs` with token classes (`bg-overlay`, `text-destructive-foreground`, `hover:bg-primary-hover`, `shadow-popover`, `shadow-dialog`, `rounded-sm`); then `pnpm exec biome check --write apps/web`. Aligning a component to Cuadre's compact density and focus ring happens in the slice that first shows it on a screen. Primitives (`components/ui`, `lib`, `hooks`, `styles`) never import screens (dependency-cruiser). `erasableSyntaxOnly` is on for all of `apps/web` (no enums, namespaces or parameter properties).
- Formatting (`es-VE` money, rates, dates, parsing) lives in `apps/web/src/lib/format` and is the only place that formats them; screens never call `Intl` or `toFixed`.

Claude Code preview pane: `.claude/launch.json` defines `web` and `api` (needs `node` on the PATH; run `docker compose up -d` first for a healthy `/health`; stop previews before switching worktrees, they share ports 5173 and 3000).

## Non-negotiable rules

- **Module boundaries:** import another module only through its `index.ts`. Never query another module's tables. Enforced by dependency-cruiser in CI.
- **Domain purity:** `domain/` never imports from `infrastructure/`, `http/`, Drizzle, Hono or any I/O.
- **Money:** never use `number` floats for money. Use the `Money` value object (integer minor units + currency). It lives in `packages/shared-kernel` with `Rate` (the exact 8-decimal exchange rate value) and `Result`. See ADR-005.
- **Documents** are `Draft` then `Issued`; issued documents are immutable and freeze their exchange rate. IGTF applies to **receipts** in foreign currency, never invoices. See ADR-005/006/013.
- **Errors:** domain and use cases return `Result` discriminated unions; throw only for truly unexpected failures. See ADR-009.
- **Cross-module writes** happen synchronously inside one DB transaction. See ADR-008.
- **Language:** code, commits, issues, PRs and docs in English; UI copy in Spanish.
- **UI guidelines & spec (ADR-012, [`docs/design/`](docs/design/README.md)):** UI issues carry a lightweight Markdown **UI spec** (states, error code → Spanish message, key `GLOSSARY.md` copy, focus/keyboard notes). If a UI issue is missing state, copy, or error details, ask the maintainer during planning before coding. Use semantic tokens from `apps/web/src/styles/tokens.css` and shadcn components in `apps/web`; UI error messages go into the single message catalog in `apps/web`. Visual layout (desktop ≥ 1280 px), keyboard/focus order, WCAG 2.2 AA basics (24×24 px targets), and copy are checked during `verify` and `REVIEW.md` item 8.
- **Tests:** domain rules are written test-first. Use cases get integration tests against real Postgres. Turn the issue's acceptance examples into tests. A slice that adds or changes a screen ships Playwright E2E tests for its acceptance criteria. Invariants named by an ADR get property tests (fast-check, pure domain only); every counterexample found stays as a fixed example test.
- **Done means verified:** see [Verification](#verification).

## Verification

See ADR-014. The reviewer's checklist is [`REVIEW.md`](REVIEW.md).

- **Cheap checks first.** The Stop hook runs typecheck, Biome and the touched packages' unit tests. Before opening a PR, also run integration tests and `pnpm verify` (it boots the app; a change is verified when it has been run, not just compiled).
- **Three rounds, then escalate.** If a check still fails after three fix attempts, stop and explain in the issue or PR which check fails and why you think it does.
- **No flaky tests.** Never skip a test, add sleeps, or retry until green (Playwright runs with `retries: 0`). If you cannot find the root cause, delete the test and say why in the PR.
- **Do not weaken the gates** (tool config, CI, `REVIEW.md`, `verify`, existing tests) to get green. If a gate must change, justify it in the PR.
- **Stamp the PR.** Fill the template's **Verification** section and its `Verified-by:` trailer with what actually ran (`none — <reason>` if nothing did).

## Workflow

- Work comes from GitHub issues labelled `agent-ready`. Do not start issues without that label.
- One issue → one branch → one small PR. Conventional Commits. PRs are squash-merged into a protected `main`.
- **Branch names are `<type>/<issue>-<slug>`:** a Conventional Commits type (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`) — the one the PR title will carry —, the issue number when there is one, and a lowercase kebab-case slug: `feat/5-design-tokens-formatting`, `fix/23-rate-lookup-weekend`; without an issue, `refactor/simplify-design-flow`. Sessions start on a generated name (`claude/<random>`): rename it with `git branch -m <name>` before the first push (renaming a published branch closes its PR). A PreToolUse hook (`.claude/hooks/branch-name.mjs`) blocks `git push` and `gh pr create` on an unpublished branch that does not match.
- **The standard flow is the `implement-issue` skill** (run from a git worktree): reviewed plan, implementation, `verify`, draft PR, review by the `pr-reviewer` agent, ready PR. Questions happen while planning; after the plan is approved, none until the final report.
- **Antigravity workspace plugin:** `.agents/plugins/cuadre/` provides the full Antigravity-native workflow (`implement-issue`, `verify`, `plan-reviewer`, `pr-reviewer`, and lifecycle hooks), coexisting with `.claude/`.
- If the issue is ambiguous (especially fiscal rules), ask in the issue instead of guessing.
- Changes to rules of the game (ADRs, fiscal rules, module boundaries) are decided by the human maintainer. Propose them; do not make them.
- A bug that reached `main` is labelled `escaped-defect` and closes only with a new `REVIEW.md` item, test or hook besides the fix. When a slice of the build order closes, prune `REVIEW.md`, this file and slow or redundant tests.

## Agent skills

### Issue tracker

GitHub Issues on `Ruberoni/cuadre`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage roles, except the agent-ready role uses the existing `agent-ready` label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `docs/GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
