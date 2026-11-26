import {
  type Money,
  money,
  parseQuantity,
  parseRate,
  QUANTITY_SCALE,
  type Quantity,
  type Rate,
} from "@cuadre/shared-kernel";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyInboundMovement,
  computeInboundCostUsd,
  deriveAverageCostUsd,
  type StockBalance,
  zeroStockBalance,
} from "./stock.ts";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

const quantityArb = fc.integer({ min: 1, max: 1_000_000_000 }).map((scaled): Quantity => {
  const parsed = parseQuantity(
    `${Math.floor(scaled / 1000)}.${String(scaled % 1000).padStart(3, "0")}`,
    { allowDecimals: true },
  );
  if (!parsed.ok) throw new Error("bad quantity");
  return parsed.value;
});
const costArb = fc.integer({ min: 0, max: 100_000_000 });
const rateArb = fc.integer({ min: 1, max: 10_000_000_000 }).map((scaled): Rate => {
  const text = `${Math.floor(scaled / 1e8)}.${String(scaled % 1e8).padStart(8, "0")}`;
  const parsed = parseRate(text);
  if (!parsed.ok) throw new Error(`bad rate ${text}`);
  return parsed.value;
});
const movementsArb = fc.array(fc.record({ quantity: quantityArb, cost: costArb }), {
  minLength: 1,
  maxLength: 8,
});

function usd(minor: number): Money {
  const parsed = money(minor, "USD");
  if (!parsed.ok) throw new Error("bad money");
  return parsed.value;
}
function apply(balance: StockBalance, quantity: Quantity, cost: number): StockBalance {
  const result = applyInboundMovement(balance, { quantity, totalCostUsd: usd(cost) });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("stock invariants (ADR-007)", () => {
  it("on hand equals the sum of the inbound movements, and so does the value", () => {
    fc.assert(
      fc.property(movementsArb, (movements) => {
        let balance = zeroStockBalance(PRODUCT);
        for (const m of movements) balance = apply(balance, m.quantity, m.cost);

        expect(balance.onHandScaled).toBe(movements.reduce((s, m) => s + m.quantity.scaled, 0n));
        expect(balance.totalValueUsd.minorUnits).toBe(movements.reduce((s, m) => s + m.cost, 0));
      }),
    );
  });

  it("the new average lies between the previous average and the inbound unit cost", () => {
    fc.assert(
      fc.property(movementsArb, quantityArb, costArb, (history, quantity, cost) => {
        let before = zeroStockBalance(PRODUCT);
        for (const m of history) before = apply(before, m.quantity, m.cost);
        const after = apply(before, quantity, cost);

        // Averages as exact fractions (value / quantity); compare by cross-multiplication.
        const prev = deriveAverageCostUsd(before);
        const next = deriveAverageCostUsd(after);
        if (prev === null || next === null) throw new Error("stock is positive");
        const unit = { n: BigInt(cost) * QUANTITY_SCALE, d: quantity.scaled };

        const lt = (a: { n: bigint; d: bigint }, b: { n: bigint; d: bigint }) =>
          a.n * b.d <= b.n * a.d;
        const prevF = { n: prev.numeratorMinor, d: prev.denominatorScaled };
        const nextF = { n: next.numeratorMinor, d: next.denominatorScaled };
        const [low, high] = lt(prevF, unit) ? [prevF, unit] : [unit, prevF];
        expect(lt(low, nextF)).toBe(true);
        expect(lt(nextF, high)).toBe(true);
      }),
    );
  });

  it("a VES cost converts at the receipt's frozen rate only: the same rate always gives the same USD", () => {
    fc.assert(
      fc.property(quantityArb, costArb, rateArb, (quantity, minor, frozen) => {
        const ves = money(minor, "VES");
        if (!ves.ok) throw new Error("bad money");
        const first = computeInboundCostUsd(quantity, ves.value, frozen);
        const again = computeInboundCostUsd(quantity, ves.value, frozen);
        expect(again).toEqual(first);
      }),
    );
  });
});
