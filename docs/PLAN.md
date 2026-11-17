# Cuadre — Plan

Outcome of the initial design session and its refinement (2026-11-16). Decisions with lasting impact are recorded as ADRs in [`adr/`](adr/); domain vocabulary lives in [`GLOSSARY.md`](GLOSSARY.md); this file holds scope and build order. It is the input for `/to-tickets`.

## Purpose

Portfolio project with real-world grounding: an ERP modelled on a small Venezuelan distribution business (single company). Developed mainly by AI agents through an **issue → PR** workflow, with CI as the safety net. Not multi-tenant, not a product for sale (for now).

Budget: ~5–10 h/week. Target: MVP in 6–8 weeks.

## MVP scope

One end-to-end flow: **buy → stock → sell → collect**.

1. **Master data:** products (SKU, unit of measure, one sale price in USD, IVA rate), suppliers, customers (with RIF).
2. **Exchange rates:** daily BCV rate, entered manually.
3. **Purchasing:** purchase order → one goods receipt per order (increases stock; is the payable).
4. **Inventory:** single warehouse, stock ledger (kardex), weighted average cost in USD.
5. **Sales:** sales order → one invoice per order, with IVA and frozen exchange rate (decreases stock).
6. **Billing:** receipts against invoices and payments against goods receipts, IGTF on receipts in foreign currency, outstanding balances.
7. **Auth:** email + password (Better Auth), one fixed role per user, enforced at the API.

### Out of MVP scope

Multiple warehouses, returns, advanced reports, multi-company, i18n. Items with a clear shape go to the [post-MVP backlog](#post-mvp-backlog); items with real unknowns go to the [fog](#fog-for-later-wayfinder).

## Domain rules

See ADR-005, 006, 007, 013.

**Money and rates**
- Money as integer minor units; never floats. Functional currency USD.
- Exchange rates are stored with 8 decimals (as the BCV publishes them). The rate for a date is the latest one dated on or before it; none → `MISSING_EXCHANGE_RATE`.
- Every document has a document currency and freezes the exchange rate when it is issued, including USD documents (for their VES equivalent).

**Documents**
- Lifecycle: `Draft` (editable, deletable, no effects) → `Issued` (immutable). Issuing freezes the rate, moves stock and opens the balance. No voiding in the MVP.
- `DocumentDate` defaults to today, may be in the past, never in the future; it drives the rate lookup.
- Documents are 1:1 and complete: one goods receipt per purchase order (may receive less; closes the order, no backorder), one invoice per sales order (required). The sales order's price defaults from the product and is editable per line.

**Taxes**
- IVA per product: 16% / 8% / exempt.
- An invoice may be issued in USD or VES. A USD invoice always shows its VES equivalent, computed on totals at the frozen rate. A VES invoice converts each line from the USD price at the frozen rate.
- Our invoices get a gapless sequential number when issued; drafts consume none. No control number of our own (that belongs to SENIAT-certified invoicing).
- The business is a `SpecialTaxpayer`: IGTF 3% is charged **on top of** each receipt made in foreign currency. It never appears on an invoice and does not reduce the outstanding balance.

**Inventory**
- Weighted average cost in USD, **excluding IVA**. A purchase in VES converts at the goods receipt's frozen rate.
- No negative stock (`INSUFFICIENT_STOCK`). Opening stock enters only through the seed and goods receipts; no adjustments or counts.

**Settlement**
- A receipt settles exactly one invoice; a payment settles exactly one goods receipt. A document may have several partial receipts or payments.
- Outstanding balances are kept in the document's currency. A receipt or payment in the other currency converts at its own frozen rate; no exchange-difference entry is recorded.
- Goods receipts record the supplier's invoice number and control number.

## Roles

One role per user. Users are created by the seed (one per role); no user admin screen in the MVP.

| | admin | sales | purchasing | warehouse |
|---|---|---|---|---|
| Products, exchange rates | write | read | read | read |
| Customers, sales orders, invoices, receipts | write | write | — | read sales orders |
| Suppliers, purchase orders, payments | write | — | write | read purchase orders |
| Goods receipts | write | — | read | write |
| Kardex, on-hand | read | read on-hand | read | read |
| Users | write | — | — | — |

## Technical baseline

See ADR-001…004, 008…012.
- pnpm + Turborepo monorepo: `apps/api` (Hono + zod-openapi), `apps/web` (React + Vite + TanStack Router/Query/Table + shadcn/ui + Tailwind + React Hook Form + Zod), `packages/contracts`, `packages/ui`.
- Modular monolith; hexagonal-lite modules; synchronous cross-module calls in one transaction; `Result` errors.
- PostgreSQL + Drizzle, module-owned tables.
- Better Auth for authentication (ADR-003).
- Quality gates in CI on every PR: TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Biome, dependency-cruiser boundaries, Vitest unit + integration (real Postgres), Playwright E2E for the happy path.
- Conventional Commits, squash merge, protected `main`.
- Local: `docker compose` (Postgres) + realistic fictitious seed from day one.

## Design (required step)

**No UI code is written without a design.** See ADR-012. Two artifacts:

- **Cuadre Design System** (Claude "Design System" artifact): source of truth for tokens and component specs. `sync-design-system` mirrors its tokens into `packages/ui`.
- **Cuadre Screens** (Claude "Design" artifact, built on the Design System): one artboard per screen. Issues link the artboard in their **Design** field.

The gate has two levels:

1. **Phase 0 — blocks all UI work, including the walking skeleton:** the Design System exists, the *App shell* and *Products* artboards exist, and its tokens are synced into `packages/ui`.
2. **Per issue — blocks `agent-ready`:** an issue that adds or changes a screen has its **Design handoff** filled in: artboard link, completed review checklist, trimmed handoff. Until it does, it carries `needs-design`. Issues with no UI write `N/A — no UI`.

Every design goes through the **review flow** in [`design/README.md`](design/README.md), using the `design` plugin skills:
- **Design System:** `/design-system extend` per component, `/accessibility-review` on tokens, `/design-system audit` before each sync.
- **Each screen:** `/ux-copy` → `/design-critique` → `/accessibility-review` → `/design-handoff`. No open 🔴 passes a step; 🟡 is fixed or justified.

Ground rules: **desktop only** (minimum 1280 px); **WCAG 2.2 AA** with 24×24 px pointer targets; UI copy uses the glossary's Spanish terms.

Design System content for Phase 0:
- **Tokens:** start from shadcn's neutral tokens, semantic names (`--background`, `--primary`…); one sans-serif (Inter), a single accent color, small radius, compact density (~32 px table rows). **Light theme only**; dark mode is a post-MVP task.
- **Components (specs):** app layout (sidebar + header), data table, form with validation, button, input, select, combobox (search product/partner), money input, status badge, confirm dialog. Code comes from the shadcn CLI in `packages/ui`; only tokens are synced.
- **Formatting guide:** locale `es-VE` (`1.234,56`), symbols `Bs.` and `$` in the UI (`VES`/`USD` only in code and currency pickers), dates `dd/mm/aaaa`. Implemented once as a formatting helper in `packages/ui`.
- **Tone:** sober, information-dense back-office UI.

Screens to design (each one just before its slice becomes `agent-ready`, not all up front):

1. Login
2. App shell (sidebar per role)
3. Products (list + form)
4. BCV rates (list + record)
5. Partners (suppliers and customers)
6. Purchase order (list + editor)
7. Goods receipt
8. Kardex per product
9. Sales order (list + editor)
10. Invoice (detail + printable view, via browser print styles)
11. Receipts and payments (record against a document)
12. Outstanding balances (receivable / payable)

## Agent setup

- `AGENTS.md` (root, short) + `AGENTS.md` per module; `CLAUDE.md` imports `AGENTS.md`.
- `.claude/`: PostToolUse hook (Biome on edited file), Stop hook (typecheck), permissions for pnpm scripts.
- Project skills: `implement-issue` (issue → worktree → TDD → PR) and `sync-design-system` (Design System tokens → `packages/ui` PR). More only when a pattern repeats 2–3 times.
- Issues follow the template in `.github/ISSUE_TEMPLATE/task.yml`; only the maintainer applies `agent-ready`.

## People

- **Maintainer:** writes and approves issues, designs in the Design System and Screens artifacts, reviews and merges PRs, decides ADRs, fiscal rules and module boundaries.
- **Agents:** implement issues, write tests and migrations, sync tokens, propose the breakdown of each epic into issues.

## Build order

Vertical tracer-bullet slices (schema → API → UI → tests). `/to-tickets` breaks each into issues. The `inventory` module is built inside slices 5 and 6, not as a standalone step.

0. **Phase 0 — Design System:** Design System + *App shell* and *Products* artboards + token sync into `packages/ui`.
1. **Walking skeleton** (pair mode, not issue → PR): monorepo, CI with all gates, docker compose, `.claude/` config, `catalog` module end to end (create + list products) with tests at every level.
2. **Auth and roles:** Better Auth, login screen, role matrix enforced at the API.
3. **BCV rates** + `Money`.
4. **Partners:** suppliers and customers.
5. **Purchasing:** purchase order → goods receipt → kardex inbound + average cost.
6. **Sales:** sales order → invoice with IVA and frozen rate → kardex outbound.
7. **Billing:** receipts and payments, IGTF, outstanding balances.
8. **E2E** for the full flow + realistic seed.

## Next steps

1. ~~Create the repo with docs, ADRs, glossary, issue template and this plan.~~
2. ~~Run `/setup-matt-pocock-skills` to connect GitHub Issues as the tracker.~~
3. ~~Refine this plan (grilling session).~~
4. **Create the Cuadre Design System and the App shell + Products artboards** (Phase 0). Required before step 6.
5. Run `/to-tickets docs/PLAN.md` to create the MVP tickets and the post-MVP backlog issues.
6. Build the walking skeleton in pair mode from the first unblocked ticket.

## Post-MVP backlog

Clear tasks waiting their turn. `/to-tickets` creates them as issues labelled `needs-triage`.

- **Dark mode:** add dark values for the semantic tokens in the Design System and sync them.
- **Responsive layouts** (tablet / mobile) for the screens that need them.
- **`design-screen` project skill:** runs the per-screen review flow and drafts the handoff. Trigger: after the third screen has gone through the flow by hand (ADR-011).
- **Storybook:** Storybook 8 (Vite) in `packages/ui`, stories only for Cuadre's own components (not plain shadcn), interaction tests through the Vitest addon in CI; visual regression later. Trigger: may be pulled into the MVP as soon as `packages/ui` gets its first own composite component (likely `MoneyInput` or `DataTable`).
- **User admin screen.**
- **Invoice PDF.**
- **Public demo deploy** (e.g. Railway/Fly + Neon, demo user, nightly reset).

## Fog for later (`/wayfinder`)

Areas with real unknowns, to be mapped as decision tickets after the MVP:
- IVA/ISLR withholdings (retenciones).
- SENIAT-certified invoicing (control numbers for our own invoices).
- General ledger / chart of accounts (and exchange-difference entries).
- Automatic BCV rate fetching.
- A separate purchase invoice document, decoupled from goods receipts.
- IGTF on payments to suppliers that are special taxpayers.
- Partial documents (backorders, partial invoicing, one receipt across several invoices).
- Voiding issued documents, credit notes and returns.
