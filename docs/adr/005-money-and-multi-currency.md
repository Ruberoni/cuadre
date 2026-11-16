# ADR-005: Money and multi-currency

**Status:** Accepted

## Context
Venezuelan businesses operate in both bolívares (VES) and US dollars (USD). The bolívar's official exchange rate (BCV) changes daily, so amounts recorded in VES lose meaning over time unless the rate used is preserved. Floating-point money is a classic source of bugs.

## Decision
- `Money` value object: integer amount in minor units plus a currency (`USD` or `VES`). All arithmetic and rounding goes through it. No floating-point `number` for money anywhere.
- **Functional currency is USD.** Reports and inventory costs are in USD.
- Every commercial document (purchase order, goods receipt, invoice, payment) has a **document currency** and **freezes the exchange rate** in effect when it is issued. Later rate changes never alter issued documents.
- Exchange rates (BCV) are stored per day in the `exchange-rates` module. In the MVP they are entered manually; automatic fetching is a later feature.
- IVA rates are configurable per product: general 16%, reduced 8%, exempt.

## Consequences
- Historical documents are always reproducible.
- Rounding rules live in one place and are unit-tested.
- Conversions require an explicit rate; there is no implicit "current rate".
