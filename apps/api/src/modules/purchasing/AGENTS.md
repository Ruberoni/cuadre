# AGENTS.md — `purchasing` module

Purchase orders (`PurchaseOrder`) in `Draft` and `Issued` status: create, edit, delete, get, list and issue (`POST /purchase-orders/{id}/issue`) (goods receipts arrive in the next ticket). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: validateDraftPurchaseOrder, validateIssuePurchaseOrder, reconstitutePurchaseOrder, calculatePurchaseOrderTotals, calculatePurchaseOrderVesEquivalent (uses @cuadre/shared-kernel)
application/      one use case per file (create, update, delete, get, list, issue) + repository port
infrastructure/   purchase-orders.table.ts (Drizzle, schema `purchasing`), Drizzle repository (`SELECT ... FOR UPDATE` on issue), idempotent demo seed
http/             Hono/OpenAPI routes (`/purchase-orders`), DTO mapper, exhaustive error-to-status maps
index.ts          the ONLY public API: createPurchasingModule({ db, partners, catalog, exchangeRates, today }) -> { routes, seed }
```

## Local rules

- **Cross-module lookups & side effects (ADR-001, ADR-008):** never query `partners`, `catalog` or `exchange_rates` tables directly. Supplier validation/enrichment goes through `partners.findSupplierById` / `partners.findSuppliersByIds`; product validation/enrichment goes through `catalog.findProductsByIds`; rate lookup and freeze on issue runs synchronously inside one DB transaction via `exchangeRates.lookupAndFreezeForDate(documentDate, tx)` coordinated by `src/shared/issue-document.ts`.
- **Money & quantities (ADR-005):** quantities are exact thousandths (`Quantity` in `@cuadre/shared-kernel`, `numeric(15, 3)` in Postgres); whole numbers for `UNIT`/`BOX`/`BULK` (`QUANTITY_NOT_WHOLE`), up to 3 decimals for `KILOGRAM`/`LITER` (`QUANTITY_TOO_PRECISE`). Line subtotals and IVA per rate are computed via `computeDocumentTotals` (IVA on taxable base of each rate, never per line). Issued USD orders compute `vesTotalEquivalent` at `frozenRate` via `computeVesEquivalent`.
- **Document lifecycle (ADR-013):** `Draft` is editable and deletable with no side effects and may have 0 lines (`frozenRate` is `null`). `DocumentDate` defaults to today, may be in the past, never in the future (`DOCUMENT_DATE_IN_FUTURE`). Issuing requires at least 1 line (`EMPTY_DOCUMENT`, 409), `DocumentDate <= today` (`VALIDATION_ERROR`, 400), and an existing rate on or before `DocumentDate` (`MISSING_EXCHANGE_RATE`, 409), freezing the rate and transitioning to `ISSUED` (`frozenRate !== null`). Non-draft orders reject edits, deletes and re-issuing with `DOCUMENT_NOT_DRAFT` (409).
- **Line-level validation issues:** `FieldIssue.field` uses `lines.<index>.productId`, `lines.<index>.quantity`, and `lines.<index>.unitCost`.
- **Roles (`PLAN → Roles`):** `admin` and `purchasing` read, write and issue; `warehouse` reads; `sales` gets 403 on every route.
