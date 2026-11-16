# ADR-007: Weighted average cost in USD

**Status:** Accepted

## Context
Selling goods requires a cost of goods sold. Options: weighted average, FIFO, standard cost. Venezuelan SMEs most commonly use weighted average. Costing in VES would be distorted by inflation.

## Decision
Inventory is valued with the **weighted average cost**, computed in **USD** (functional currency) from the stock ledger (kardex). Each receipt recalculates the average; each issue uses the current average.

Example: 10 units at 5.00 USD, then receive 10 units at 7.00 USD → average 6.00 USD.

## Consequences
- Simple to implement over the kardex.
- FIFO-dependent reports are not available.
