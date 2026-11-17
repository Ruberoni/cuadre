# AGENTS.md — Cuadre

Cuadre is an ERP for a small Venezuelan distribution business (single company). It is a personal portfolio project built primarily by AI agents working from GitHub issues. This file is the source of truth for every agent (Claude Code, Codex, Cursor…); `CLAUDE.md` only imports it.

> **Status:** walking skeleton in progress. The monorepo, tooling and CI gates exist; business modules and UI arrive slice by slice. The plan lives in [`docs/PLAN.md`](docs/PLAN.md). Commands marked _(planned)_ arrive with the catalog slice.

## Read before working

1. [`docs/PLAN.md`](docs/PLAN.md) — scope, MVP flow, build order.
2. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — domain vocabulary. Use these names exactly; never invent synonyms.
3. [`docs/adr/`](docs/adr/) — architecture decisions. If your change contradicts an ADR, stop and ask; do not reopen the debate in code.
4. The `AGENTS.md` inside the module you are touching _(planned, one per module)_.

## Repo map

```
apps/api/                 Hono + @hono/zod-openapi HTTP server hosting all modules
  src/modules/<module>/
    domain/               entities, value objects, pure rules — NO I/O imports
    application/          use cases, one per file
    infrastructure/       Drizzle tables + repositories owned by this module
    http/                 Hono routes
    index.ts              the ONLY public API of the module
    AGENTS.md             module-local rules
apps/web/                 React SPA (Vite, TanStack Router/Query/Table, shadcn/ui, Tailwind)
packages/ui/              design tokens (synced from the Cuadre Design System) + shadcn components
packages/contracts/       shared Zod schemas
docs/                     PLAN, GLOSSARY, ADRs
```

Modules (MVP): `catalog`, `partners`, `purchasing`, `inventory`, `sales`, `billing`, `exchange-rates`.

## Commands

Requires Node 26 (`.nvmrc`; `nvm use 26`) and pnpm (`npm i -g pnpm`; the version is pinned in `package.json`).

```bash
pnpm install
docker compose up -d     # Postgres on localhost:5433 (override with POSTGRES_PORT); no .env needed
pnpm db:migrate          # migrate the dev database
pnpm db:seed             # seed it (a no-op until the first module lands)
pnpm dev                 # api (http://localhost:3000, GET /health, /openapi.json) + web (http://localhost:5173)
pnpm test                # unit + integration (integration needs Postgres, uses the cuadre_test database)
pnpm test:unit
pnpm test:integration
pnpm test:e2e            # Playwright smoke (PLAYWRIGHT_CHANNEL=msedge uses an installed browser)
pnpm typecheck
pnpm lint                # Biome + dependency-cruiser (pnpm lint:boundaries)
pnpm verify              # (planned) boot the app and run the smoke E2E (ADR-014)
```

`docker compose down -v` recreates the database volume (the `cuadre_test` database is created only on a fresh volume).

Each module declares its Drizzle tables in `src/modules/<module>/infrastructure/*.table.ts` (ADR-004); `drizzle-kit` picks them up from there.

Claude Code preview pane: `.claude/launch.json` defines `web` and `api` (needs `node` on the PATH; run `docker compose up -d` first for a healthy `/health`; stop previews before switching worktrees, they share ports 5173 and 3000).

## Non-negotiable rules

- **Module boundaries:** import another module only through its `index.ts`. Never query another module's tables. Enforced by dependency-cruiser in CI.
- **Domain purity:** `domain/` never imports from `infrastructure/`, `http/`, Drizzle, Hono or any I/O.
- **Money:** never use `number` floats for money. Use the `Money` value object (integer minor units + currency). See ADR-005.
- **Documents** are `Draft` then `Issued`; issued documents are immutable and freeze their exchange rate. IGTF applies to **receipts** in foreign currency, never invoices. See ADR-005/006/013.
- **Errors:** domain and use cases return `Result` discriminated unions; throw only for truly unexpected failures. See ADR-009.
- **Cross-module writes** happen synchronously inside one DB transaction. See ADR-008.
- **Language:** code, commits, issues, PRs and docs in English; UI copy in Spanish.
- **Design is a required step (ADR-012, [`docs/design/`](docs/design/README.md)):** a screen is built only from the issue's **Design handoff** (artboard link + completed review checklist + handoff). If an issue touches `apps/web` and that checklist is incomplete, stop and ask in the issue. Do not invent tokens; use `packages/ui`. UI error messages come from the handoff and go into the single message catalog in `apps/web`.
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
