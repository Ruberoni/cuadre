# ADR-005: Money and multi-currency

**Status:** Accepted (amended 2026-11-16)

## Context
Venezuelan businesses operate in both bolívares (VES) and US dollars (USD). The bolívar's official exchange rate (BCV) changes daily, so amounts recorded in VES lose meaning over time unless the rate used is preserved. Floating-point money is a classic source of bugs.

## Decision
- `Money` value object: integer amount in minor units plus a currency (`USD` or `VES`). All arithmetic and rounding goes through it. No floating-point `number` for money anywhere.
- **Functional currency is USD.** Reports and inventory costs are in USD. Each product has a single sale price, in USD.
- Every commercial document (purchase order, goods receipt, sales order, invoice, receipt, payment) has a **document currency** and **freezes the exchange rate** when it is issued (ADR-013), USD documents included. Later rate changes never alter issued documents.
- Exchange rates (BCV) are stored per day in the `exchange-rates` module, as exact decimals with 8 decimal places (never floats). In the MVP they are entered manually; automatic fetching is a later feature.
- The rate for a document is the **latest rate dated on or before its `DocumentDate`** (this covers weekends and holidays). If there is none, the document cannot be issued: `MISSING_EXCHANGE_RATE`.
- An invoice in USD always shows its VES equivalent, computed on totals at the frozen rate. An invoice in VES converts each line from the USD price at the frozen rate.
- Outstanding balances are kept in the document's currency. A receipt or payment in the other currency converts at its own frozen rate; no exchange-difference entry is recorded (there is no general ledger).
- IVA rates are configurable per product: general 16%, reduced 8%, exempt.

## Consequences
- Historical documents are always reproducible.
- Rounding rules live in one place and are unit-tested.
- Conversions require an explicit rate; there is no implicit "current rate".
- Gains or losses from rate changes between invoicing and collection are not tracked until a general ledger exists.
