# ADR-007: Weighted average cost in USD

**Status:** Accepted (amended 2026-11-16, 2026-11-17)

## Context
Selling goods requires a cost of goods sold. Options: weighted average, FIFO, standard cost. Venezuelan SMEs most commonly use weighted average. Costing in VES would be distorted by inflation.

## Decision
Inventory is valued with the **weighted average cost**, computed in **USD** (functional currency) from the stock ledger (kardex). Each inbound movement recalculates the average; each outbound movement uses the current average.

- Cost **excludes IVA**: purchase IVA is a tax credit, not cost.
- A goods receipt in VES converts to USD at the **goods receipt's** frozen rate, not the purchase order's.
- Stock never goes negative: an outbound movement larger than `OnHand` fails with `INSUFFICIENT_STOCK`.
- Each product keeps its **total stock value** (USD, in cents) and **quantity**; the average is derived as value ÷ quantity, never stored rounded. An outbound movement takes `round(quantity × average)`; the movement that brings `OnHand` to zero takes the whole remaining value. This avoids drift: value is exactly zero when stock is zero. Storing a rounded average (cents or 4 decimals) was rejected because rounding errors accumulate.
- The inbound cost is the goods receipt's unit cost, which defaults from the purchase order and can be edited to match the supplier's invoice.

Example: 10 units at 5.00 USD, then receive 10 units at 7.00 USD → average 6.00 USD.

## Consequences
- Simple to implement over the kardex.
- FIFO-dependent reports are not available.
