# ADR-006: IGTF is charged on payments

**Status:** Accepted

## Context
The IGTF (Impuesto a las Grandes Transacciones Financieras, 3%) applies to payments made in foreign currency, not to the sale itself. Many systems wrongly add it to the invoice total, which breaks when an invoice is paid partly in VES and partly in USD.

## Decision
IGTF is computed in the `billing` module on each **payment** received in foreign currency, at 3% of the paid amount (rate configurable). Invoices never contain IGTF lines.

Example: an invoice for 100.00 USD paid in full in USD → IGTF of 3.00 USD on the payment. The same invoice paid in VES → no IGTF.

## Consequences
- Mixed-currency payments are handled naturally.
- Invoice totals stay stable regardless of how they are paid.
