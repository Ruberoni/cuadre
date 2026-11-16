# ADR-007: Weighted average cost in USD

**Status:** Accepted (amended 2026-11-16)

## Context
Selling goods requires a cost of goods sold. Options: weighted average, FIFO, standard cost. Venezuelan SMEs most commonly use weighted average. Costing in VES would be distorted by inflation.

## Decision
Inventory is valued with the **weighted average cost**, computed in **USD** (functional currency) from the stock ledger (kardex). Each inbound movement recalculates the average; each outbound movement uses the current average.

- Cost **excludes IVA**: purchase IVA is a tax credit, not cost.
- A goods receipt in VES converts to USD at the **goods receipt's** frozen rate, not the purchase order's.
- Stock never goes negative: an outbound movement larger than `OnHand` fails with `INSUFFICIENT_STOCK`.

Example: 10 units at 5.00 USD, then receive 10 units at 7.00 USD → average 6.00 USD.

## Consequences
- Simple to implement over the kardex.
- FIFO-dependent reports are not available.
