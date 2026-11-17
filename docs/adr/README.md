# Architecture Decision Records

Short records of decisions that shape the codebase. Format: **Context → Decision → Consequences**. Status is `Accepted`, `Superseded by ADR-XXX`, or `Proposed`.

Agents: if your change conflicts with an accepted ADR, stop and ask in the issue. New ADRs are proposed in a PR and accepted by the maintainer.

| ADR | Title |
|---|---|
| [001](001-modular-monolith.md) | Modular monolith |
| [002](002-pnpm-turborepo-monorepo.md) | pnpm + Turborepo monorepo |
| [003](003-hono-zod-openapi.md) | Hono + zod-openapi for the API |
| [004](004-postgres-drizzle-module-owned-tables.md) | Postgres + Drizzle, module-owned tables |
| [005](005-money-and-multi-currency.md) | Money and multi-currency |
| [006](006-igtf-on-payments.md) | IGTF is charged on receipts, not invoices |
| [007](007-weighted-average-cost.md) | Weighted average cost in USD |
| [008](008-synchronous-cross-module-calls.md) | Synchronous cross-module calls in one transaction |
| [009](009-result-errors.md) | Domain errors as Result |
| [010](010-language-policy.md) | English code, Spanish UI |
| [011](011-agents-md-source-of-truth.md) | AGENTS.md as agent source of truth |
| [012](012-design-canvas-owns-tokens.md) | Design System owns the tokens; screens are designed before they are built |
| [013](013-draft-issued-document-lifecycle.md) | Documents are Draft, then Issued and immutable |
| [014](014-verification-layer.md) | Verification layer |
