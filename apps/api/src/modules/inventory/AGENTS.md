# AGENTS.md — `inventory` module

Stock of each product: on-hand quantity and total stock value in USD, plus the stock ledger (kardex). Inbound writes arrive from goods receipts; outbound writes and `INSUFFICIENT_STOCK` enforcement on issue arrive with the sales slice. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: StockBalance, computeInboundCostUsd, computeUnitCostUsd, applyInboundMovement, buildStockLedger, deriveAverageCostUsd (exact fraction), deriveRoundedAverageCostUsd
application/      recordInboundMovementsUseCase, getKardexUseCase + the repository and lookup ports
infrastructure/   inventory.table.ts (Drizzle, schema `inventory`), Drizzle repository
http/             Hono/OpenAPI routes (`GET /kardex/:productId`) + exhaustive error-to-status map
index.ts          the ONLY public API: createInventoryModule({ db }) -> { recordInboundMovements, getStockBalance, getOnHandByProductIds, createRoutes }
```

## Local rules

- **ADR-007:** each product keeps its **total stock value** (USD cents) and **quantity**; the average is derived (`value ÷ quantity`) and never stored rounded. The cost excludes IVA. A VES cost converts the **line subtotal** (`quantity × unit cost`) at the source document's frozen rate, never another rate. `buildStockLedger` replays movements chronologically from zero to compute running `onHandAfter` and `averageCostAfter` without drift.
- **ADR-008:** `recordInboundMovements(items, tx)` runs inside the caller's transaction and never opens its own, so a failure in the caller rolls back stock, movements and the rate freeze together. Balances are locked `FOR UPDATE` in product-id order.
- **Errors (ADR-009):** use cases return a `Result`; `http/error-status.ts` maps every failure code with an exhaustive `Record`. Throw only for unexpected failures.
- **Data (ADR-004):** never query `catalog` or `purchasing` tables; `product_id` and `reference_id` are logical references with no cross-schema FK. Cross-module reads (`KardexLookups`) are injected at wire time in `app.ts`. Other modules never read `inventory.*` tables: they use `getStockBalance` or `getOnHandByProductIds`.
- **Roles (PLAN → Roles):** `GET /api/kardex/:productId` allows `admin`, `purchasing`, `warehouse` (`KARDEX_ROLES.read`); `sales` reads on-hand only through `GET /api/products` and receives 403 on the kardex API.
