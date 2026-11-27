# AGENTS.md — `purchasing` module

Purchase orders (`PurchaseOrder`) and goods receipts (`GoodsReceipt`) in `Draft` and `Issued` status: create, edit, delete, get, list and issue (`POST /purchase-orders/{id}/issue`, `POST /goods-receipts/{id}/issue`). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: purchase-order.ts and goods-receipt.ts (uses @cuadre/shared-kernel)
application/      one use case per file (create, update, delete, get, list, issue) + repository ports
infrastructure/   purchase-orders.table.ts & goods-receipts.table.ts (Drizzle, schema `purchasing`), Drizzle repositories (`SELECT ... FOR UPDATE` on issue), idempotent demo seeds
http/             Hono/OpenAPI routes (`/purchase-orders`, `/goods-receipts`), DTO mappers, exhaustive error-to-status maps
index.ts          the ONLY public API: createPurchasingModule({ db, partners, catalog, exchangeRates, inventory, today }) -> { routes, seed }
```

## Local rules

- **Cross-module lookups & side effects (ADR-001, ADR-008):** never query `partners`, `catalog`, `exchange_rates` or `inventory` tables directly. Supplier validation/enrichment goes through `partners.findSupplierById` / `partners.findSuppliersByIds`; product validation/enrichment goes through `catalog.findProductsByIds`; rate lookup and freeze on issue runs synchronously inside one DB transaction via `exchangeRates.lookupAndFreezeForDate(documentDate, tx)` coordinated by `src/shared/issue-document.ts`; inbound stock movements on goods-receipt issue run synchronously in the same transaction via `inventory.recordInboundMovements(items, tx)`.
- **Money & quantities (ADR-005):** quantities are exact thousandths (`Quantity` in `@cuadre/shared-kernel`, `numeric(15, 3)` in Postgres); whole numbers for `UNIT`/`BOX`/`BULK` (`QUANTITY_NOT_WHOLE`), up to 3 decimals for `KILOGRAM`/`LITER` (`QUANTITY_TOO_PRECISE`). Line subtotals and IVA per rate are computed via `computeDocumentTotals` (IVA on taxable base of each rate, never per line). Issued USD documents compute `vesTotalEquivalent` at `frozenRate` via `computeVesEquivalent`.
- **Document lifecycle (ADR-013):** `Draft` is editable and deletable with no side effects and may have 0 lines (`frozenRate` is `null`). `DocumentDate` defaults to today, may be in the past, never in the future (`DOCUMENT_DATE_IN_FUTURE`). Issuing requires at least 1 line (`EMPTY_DOCUMENT`, 409), `DocumentDate <= today` (`VALIDATION_ERROR`, 400), and an existing rate on or before `DocumentDate` (`MISSING_EXCHANGE_RATE`, 409), freezing the rate and transitioning to `ISSUED` (`frozenRate !== null`). Non-draft documents reject edits, deletes and re-issuing with `DOCUMENT_NOT_DRAFT` (409).
- **Goods receipts (1:1 with issued purchase orders, ADR-007):**
  - Only an `ISSUED` purchase order may be received (`PURCHASE_ORDER_NOT_ISSUED`, 409); at most one receipt per order (`GOODS_RECEIPT_ALREADY_EXISTS`, 409, also enforced by `goods_receipts_purchase_order_unique`).
  - `supplierInvoiceNumber` and `controlNumber` are required (trimmed non-empty, max 50 chars).
  - Receipt lines reference distinct `purchaseOrderLineId`s of the parent order (unreceived lines may be omitted); quantities must be `0 < quantity <= orderedQuantity` (`QUANTITY_EXCEEDS_ORDERED`); unit costs default from the order and are editable in the order's currency without modifying the order.
  - Issuing a goods receipt raises stock in USD excluding IVA (VES receipts convert line subtotals at the receipt's own frozen rate).
- **Line-level validation issues:** `FieldIssue.field` uses `lines.<index>.productId` (PO), `lines.<index>.purchaseOrderLineId` (receipt), `lines.<index>.quantity`, and `lines.<index>.unitCost`.
- **Roles (`PLAN → Roles`):**
  - Purchase orders: `admin` and `purchasing` read, write and issue; `warehouse` reads; `sales` gets 403 on every route.
  - Goods receipts: `admin` and `warehouse` read, write and issue; `purchasing` reads; `sales` gets 403 on every route.
