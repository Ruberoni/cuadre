# ADR-013: Documents are Draft, then Issued and immutable

**Status:** Accepted

## Context
Commercial documents (purchase orders, goods receipts, sales orders, invoices, receipts, payments) have side effects: they freeze an exchange rate, move stock and open or settle balances. Users need to prepare a document before it takes effect. Once it takes effect, editing it would rewrite history: stock, average cost and balances computed from it would silently become wrong. Undoing an issued invoice properly requires credit notes, which are out of the MVP.

## Decision
- Every document has two states: **`Draft`** (editable and deletable, no side effects) and **`Issued`** (immutable).
- Issuing is the single moment when side effects happen: the exchange rate is frozen, stock moves, balances open or settle, and invoices receive their gapless sequential number.
- Issued documents are never edited, deleted or voided in the MVP. Corrections wait for credit notes and voiding (see the plan's fog).
- Each document has a `DocumentDate`: defaults to today, may be in the past, never in the future. It drives the exchange-rate lookup (ADR-005).

## Consequences
- Side effects live in one use case per document (`issue…`), easy to test and to run inside one transaction (ADR-008).
- Drafts do not consume invoice numbers, so numbering stays gapless.
- A mistake on an issued document cannot be fixed in the MVP; seed and demo data must be correct.
