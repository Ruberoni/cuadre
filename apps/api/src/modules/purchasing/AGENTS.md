# AGENTS.md — `purchasing` module

Purchase orders (`PurchaseOrder`) in `Draft` status: create, edit, delete, get and list (issuing and goods receipts arrive in the next tickets). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: validateDraftPurchaseOrder, calculatePurchaseOrderTotals (uses Quantity, Money, computeDocumentTotals from @cuadre/shared-kernel)
application/      one use case per file (create, update, delete, get, list) + repository port
infrastructure/   purchase-orders.table.ts (Drizzle, schema `purchasing`), Drizzle repository, idempotent demo seed
http/             Hono/OpenAPI routes (`/purchase-orders`), DTO mapper, exhaustive error-to-status maps
index.ts          the ONLY public API: createPurchasingModule({ db, partners, catalog, today }) -> { routes, seed }
```

## Local rules

- **Cross-module lookups (ADR-001):** never query `partners` or `catalog` tables directly. Supplier validation/enrichment goes through `partners.findSupplierById` / `partners.findSuppliersByIds`; product validation/enrichment goes through `catalog.findProductsByIds`.
- **Money & quantities (ADR-005):** quantities are exact thousandths (`Quantity` in `@cuadre/shared-kernel`, `numeric(15, 3)` in Postgres); whole numbers for `UNIT`/`BOX`/`BULK` (`QUANTITY_NOT_WHOLE`), up to 3 decimals for `KILOGRAM`/`LITER` (`QUANTITY_TOO_PRECISE`). Line subtotals and IVA per rate are computed via `computeDocumentTotals` (IVA on taxable base of each rate, never per line).
- **Document lifecycle (ADR-013):** `Draft` is editable and deletable with no side effects and may have 0 lines. `DocumentDate` defaults to today, may be in the past, never in the future (`DOCUMENT_DATE_IN_FUTURE`). Non-draft orders reject edits and deletes with `DOCUMENT_NOT_DRAFT` (409).
- **Line-level validation issues:** `FieldIssue.field` uses `lines.<index>.productId`, `lines.<index>.quantity`, and `lines.<index>.unitCost`.
- **Roles (`PLAN → Roles`):** `admin` and `purchasing` read and write; `warehouse` reads; `sales` gets 403 on every route.
