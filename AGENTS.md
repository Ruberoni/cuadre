# AGENTS.md — Cuadre

Cuadre is an ERP for a small Venezuelan distribution business (single company). It is a personal portfolio project built primarily by AI agents working from GitHub issues. This file is the source of truth for every agent (Claude Code, Codex, Cursor…); `CLAUDE.md` only imports it.

> **Status:** pre-skeleton. No application code exists yet. The plan lives in [`docs/PLAN.md`](docs/PLAN.md). Commands below marked _(planned)_ arrive with the walking skeleton.

## Read before working

1. [`docs/PLAN.md`](docs/PLAN.md) — scope, MVP flow, build order.
2. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — domain vocabulary. Use these names exactly; never invent synonyms.
3. [`docs/adr/`](docs/adr/) — architecture decisions. If your change contradicts an ADR, stop and ask; do not reopen the debate in code.
4. The `AGENTS.md` inside the module you are touching _(planned, one per module)_.

## Repo map (planned)

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
packages/ui/              design tokens + shadcn components (synced from the Design System canvas)
packages/contracts/       shared Zod schemas
docs/                     PLAN, GLOSSARY, ADRs
```

Modules (MVP): `catalog`, `partners`, `purchasing`, `inventory`, `sales`, `billing`, `exchange-rates`.

## Commands (planned)

```bash
pnpm install
docker compose up -d     # Postgres
pnpm dev                 # api + web
pnpm test                # all tests
pnpm typecheck
pnpm lint                # Biome + dependency-cruiser
pnpm db:migrate
pnpm db:seed
```

## Non-negotiable rules

- **Module boundaries:** import another module only through its `index.ts`. Never query another module's tables. Enforced by dependency-cruiser in CI.
- **Domain purity:** `domain/` never imports from `infrastructure/`, `http/`, Drizzle, Hono or any I/O.
- **Money:** never use `number` floats for money. Use the `Money` value object (integer minor units + currency). See ADR-005.
- **Documents freeze their exchange rate** at issue time. IGTF applies to **payments** in foreign currency, not invoices. See ADR-005/006.
- **Errors:** domain and use cases return `Result` discriminated unions; throw only for truly unexpected failures. See ADR-009.
- **Cross-module writes** happen synchronously inside one DB transaction. See ADR-008.
- **Language:** code, commits, issues, PRs and docs in English; UI copy in Spanish.
- **Design:** new screens must follow the linked design in the Design System canvas. Do not invent tokens; use `packages/ui`.
- **Tests:** domain rules are written test-first. Use cases get integration tests against real Postgres. Turn the issue's acceptance examples into tests.
- **Done means green:** typecheck, lint, boundaries and tests pass locally before opening a PR.

## Workflow

- Work comes from GitHub issues labelled `agent-ready`. Do not start issues without that label.
- One issue → one branch → one small PR. Conventional Commits. PRs are squash-merged into a protected `main`.
- If the issue is ambiguous (especially fiscal rules), ask in the issue instead of guessing.
- Changes to rules of the game (ADRs, fiscal rules, module boundaries) are decided by the human maintainer. Propose them; do not make them.

## Agent skills

### Issue tracker

GitHub Issues on `Ruberoni/cuadre`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage roles, except the agent-ready role uses the existing `agent-ready` label. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `docs/GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
