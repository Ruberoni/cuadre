# Cuadre — Plan

Outcome of the initial design session (2026-11-16). Decisions with lasting impact are recorded as ADRs in [`adr/`](adr/); this file holds scope and build order. It is the input for `/to-tickets`.

## Purpose

Portfolio project with real-world grounding: an ERP modelled on a small Venezuelan distribution business (single company). Developed mainly by AI agents through an **issue → PR** workflow, with CI as the safety net. Not multi-tenant, not a product for sale (for now).

Budget: ~5–10 h/week. Target: MVP in 6–8 weeks.

## MVP scope

One end-to-end flow: **buy → stock → sell → collect**.

1. **Master data:** products (SKU, unit of measure, price, IVA rate), suppliers, customers (with RIF).
2. **Exchange rates:** daily BCV rate, entered manually.
3. **Purchasing:** purchase order → goods receipt (increases stock).
4. **Inventory:** single warehouse, stock ledger (kardex), weighted average cost in USD.
5. **Sales:** sales order → invoice with IVA and frozen exchange rate (decreases stock).
6. **Billing:** customer receipts and supplier payments against documents, IGTF on foreign-currency payments, outstanding balances.
7. **Auth:** email + password, fixed roles `admin`, `sales`, `purchasing`, `warehouse`, enforced at the API.

### Out of MVP scope

General ledger / chart of accounts, multiple warehouses, returns, credit notes, advanced reports, SENIAT-certified invoicing, IVA/ISLR withholdings (retenciones), automatic BCV rate fetching, multi-company, i18n.

## Domain rules (summary)

See ADR-005, 006, 007.
- Money as integer minor units; never floats. Functional currency USD.
- Every document has a document currency and freezes the exchange rate at issue time.
- IVA per product: 16% / 8% / exempt.
- IGTF 3% on payments in foreign currency, never on the invoice.
- Weighted average cost in USD.

## Technical baseline

See ADR-001…004, 008…012.
- pnpm + Turborepo monorepo: `apps/api` (Hono + zod-openapi), `apps/web` (React + Vite + TanStack Router/Query/Table + shadcn/ui + Tailwind + React Hook Form + Zod), `packages/contracts`, `packages/ui`.
- Modular monolith; hexagonal-lite modules; synchronous cross-module calls in one transaction; `Result` errors.
- PostgreSQL + Drizzle, module-owned tables.
- Better Auth (or similar) for authentication.
- Quality gates in CI on every PR: TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Biome, dependency-cruiser boundaries, Vitest unit + integration (real Postgres), Playwright E2E for the happy path.
- Conventional Commits, squash merge, protected `main`.
- Local: `docker compose` (Postgres) + realistic fictitious seed from day one. Public demo deploy (e.g. Railway/Fly + Neon, demo user, nightly reset) only after the MVP.

## Agent setup

- `AGENTS.md` (root, short) + `AGENTS.md` per module; `CLAUDE.md` imports `AGENTS.md`.
- `.claude/`: PostToolUse hook (Biome on edited file), Stop hook (typecheck), permissions for pnpm scripts.
- Project skills: `implement-issue` (issue → worktree → TDD → PR) and `sync-design-system` (canvas tokens → `packages/ui` PR). More only when a pattern repeats 2–3 times.
- Issues follow the template in `.github/ISSUE_TEMPLATE/task.yml`; only the maintainer applies `agent-ready`.

## Design

- A Design System canvas (Claude design artifact) owns tokens and component specs (ADR-012).
- Every new screen is designed in the canvas before its issue becomes `agent-ready`.
- Tone: sober, information-dense back-office UI.

## Roles

- **Maintainer:** writes and approves issues, designs in the canvas, reviews and merges PRs, decides ADRs, fiscal rules and module boundaries.
- **Agents:** implement issues, write tests and migrations, sync tokens, propose the breakdown of each epic into issues.

## Build order (draft — to be refined by `/to-tickets`)

This order is a starting point. `/to-tickets` will reshape it into **vertical tracer-bullet slices** (schema → API → UI → tests), e.g. "record a purchase in USD and see the stock" rather than a standalone "Money" layer.

1. **Walking skeleton** (pair mode, not issue → PR): monorepo, CI with all gates, docker compose, `.claude/` config, `catalog` module end to end (create + list products) with tests at every level and its screen in the canvas.
2. `Money` + exchange rates.
3. Suppliers and customers.
4. Purchasing: purchase order → goods receipt.
5. Inventory: kardex + weighted average cost.
6. Sales: sales order → invoice with IVA and frozen rate.
7. Billing: receipts/payments with IGTF, outstanding balances.
8. Auth and roles.
9. E2E for the full flow + realistic seed.

## Next steps

1. ~~Create the repo with docs, ADRs, glossary, issue template and this plan.~~
2. Run `/setup-matt-pocock-skills` to connect GitHub Issues as the tracker.
3. Run `/to-tickets docs/PLAN.md` to create the MVP tickets.
4. Create the Design System canvas.
5. Build the walking skeleton in pair mode from the first unblocked ticket.

## Fog for later (`/wayfinder`)

Areas with real unknowns, to be mapped as decision tickets after the MVP: IVA/ISLR withholdings (contribuyentes especiales), SENIAT-certified invoicing, general ledger, automatic BCV rate fetching.
