# ADR-006: IGTF is charged on receipts, not invoices

**Status:** Accepted (amended 2026-11-16)

## Context
The IGTF (Impuesto a las Grandes Transacciones Financieras, 3%) applies to payments made in foreign currency, not to the sale itself. Many systems wrongly add it to the invoice total, which breaks when an invoice is paid partly in VES and partly in USD. A business collects IGTF from its customers only when it is a special taxpayer (contribuyente especial).

## Decision
- The business is a `SpecialTaxpayer`.
- IGTF is computed in the `billing` module on each **`Receipt`** (money received from a customer) made in foreign currency, at 3% of the amount applied (rate configurable), whatever the invoice's currency. It is charged **on top**: it does not reduce the outstanding balance.
- Invoices never contain IGTF lines.
- IGTF on `Payment`s to suppliers is out of the MVP.

Example: an invoice for 100.00 USD settled in full in USD → the customer hands over 103.00 USD; 100.00 settles the invoice (balance 0.00) and 3.00 is IGTF. The same invoice settled in VES → no IGTF.

## Consequences
- Mixed-currency settlement is handled naturally.
- Invoice totals stay stable regardless of how they are paid.
- Supplier-side IGTF must be revisited before the system handles a supplier that is a special taxpayer.
