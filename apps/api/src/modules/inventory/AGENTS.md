# AGENTS.md — `inventory` module

Stock of each product: on-hand quantity and total stock value in USD, plus the stock ledger (kardex). Inbound only for now (goods receipts raise stock); outbound and `INSUFFICIENT_STOCK` arrive with the sales slice. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: StockBalance, computeInboundCostUsd, applyInboundMovement, deriveAverageCostUsd (exact fraction), deriveRoundedAverageCostUsd
application/      recordInboundMovementsUseCase + the repository port
infrastructure/   inventory.table.ts (Drizzle, schema `inventory`), Drizzle repository
index.ts          the ONLY public API: createInventoryModule({ db }) -> { recordInboundMovements, getStockBalance }
```

No HTTP routes yet: the module is called synchronously by other modules.

## Local rules

- **ADR-007:** each product keeps its **total stock value** (USD cents) and **quantity**; the average is derived (`value ÷ quantity`) and never stored rounded. The cost excludes IVA. A VES cost converts the **line subtotal** (`quantity × unit cost`) at the source document's frozen rate, never another rate.
- **ADR-008:** `recordInboundMovements(items, tx)` runs inside the caller's transaction and never opens its own, so a failure in the caller rolls back stock, movements and the rate freeze together. Balances are locked `FOR UPDATE` in product-id order.
- **Errors (ADR-009):** the use case returns a `Result` (`AMOUNT_OUT_OF_RANGE`, `QUANTITY_OUT_OF_RANGE`, `INVALID_COST`); it throws only for unexpected failures.
- **Data (ADR-004):** never query `catalog` tables; `product_id` is a logical reference with no cross-schema FK. Other modules never read `inventory.*` tables: they use `getStockBalance`.
