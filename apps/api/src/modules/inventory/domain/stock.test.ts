import {
  type Money,
  money,
  parseQuantity,
  parseRate,
  type Quantity,
  type Rate,
} from "@cuadre/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  applyInboundMovement,
  buildStockLedger,
  computeInboundCostUsd,
  computeUnitCostUsd,
  deriveAverageCostUsd,
  deriveRoundedAverageCostUsd,
  type StockBalance,
  zeroStockBalance,
} from "./stock.ts";

const PRODUCT = "11111111-1111-4111-8111-111111111111";

function qty(raw: string): Quantity {
  const parsed = parseQuantity(raw, { allowDecimals: true });
  if (!parsed.ok) throw new Error(`bad quantity ${raw}`);
  return parsed.value;
}
function cash(minor: number, currency: "USD" | "VES" = "USD"): Money {
  const parsed = money(minor, currency);
  if (!parsed.ok) throw new Error("bad money");
  return parsed.value;
}
function rate(raw: string): Rate {
  const parsed = parseRate(raw);
  if (!parsed.ok) throw new Error(`bad rate ${raw}`);
  return parsed.value;
}
function inbound(balance: StockBalance, quantity: string, totalMinor: number): StockBalance {
  const result = applyInboundMovement(balance, {
    quantity: qty(quantity),
    totalCostUsd: cash(totalMinor),
  });
  if (!result.ok) throw new Error(`inbound failed: ${result.error}`);
  return result.value;
}

describe("applyInboundMovement (ADR-007)", () => {
  it("10 units at $5,00 plus 10 units at $7,00 gives 20 on hand at an average of $6,00", () => {
    const first = inbound(zeroStockBalance(PRODUCT), "10", 5000);
    const second = inbound(first, "10", 7000);

    expect(second.onHandScaled).toBe(20_000n);
    expect(second.totalValueUsd).toEqual(cash(12000));
    expect(deriveRoundedAverageCostUsd(second)).toEqual(cash(600));
  });

  it("3 units received for $10,00 in total keep the value exact; the average is derived, not stored", () => {
    const balance = inbound(zeroStockBalance(PRODUCT), "3", 1000);

    expect(balance.totalValueUsd).toEqual(cash(1000));
    expect(balance.onHandScaled).toBe(3000n);
    // 1000 cents / 3 units, as an exact fraction (3,3333…): nothing rounded lives in the balance.
    expect(deriveAverageCostUsd(balance)).toEqual({
      numeratorMinor: 1_000_000n,
      denominatorScaled: 3000n,
    });
    expect(deriveRoundedAverageCostUsd(balance)).toEqual(cash(333));
    expect(Object.keys(balance).sort()).toEqual(["onHandScaled", "productId", "totalValueUsd"]);
  });

  it("has no average while nothing is on hand", () => {
    expect(deriveAverageCostUsd(zeroStockBalance(PRODUCT))).toBeNull();
    expect(deriveRoundedAverageCostUsd(zeroStockBalance(PRODUCT))).toBeNull();
  });

  it("rejects a cost that is not in USD or is negative", () => {
    const zero = zeroStockBalance(PRODUCT);
    expect(
      applyInboundMovement(zero, { quantity: qty("1"), totalCostUsd: cash(100, "VES") }),
    ).toEqual({ ok: false, error: "INVALID_COST" });
    expect(applyInboundMovement(zero, { quantity: qty("1"), totalCostUsd: cash(-1) })).toEqual({
      ok: false,
      error: "INVALID_COST",
    });
  });

  it("returns a Result instead of overflowing the stored quantity or value", () => {
    const full = inbound(zeroStockBalance(PRODUCT), "999999999999", 0);
    expect(applyInboundMovement(full, { quantity: qty("2"), totalCostUsd: cash(0) })).toEqual({
      ok: false,
      error: "QUANTITY_OUT_OF_RANGE",
    });

    const rich = inbound(zeroStockBalance(PRODUCT), "1", 10 ** 15);
    expect(applyInboundMovement(rich, { quantity: qty("1"), totalCostUsd: cash(1) })).toEqual({
      ok: false,
      error: "AMOUNT_OUT_OF_RANGE",
    });
  });
});

describe("computeInboundCostUsd (ADR-007: excludes IVA, converts VES at the receipt's frozen rate)", () => {
  it("a USD line costs quantity × unit cost: 50 × $2,00 is $100,00, not $116,00 with IVA", () => {
    expect(computeInboundCostUsd(qty("50"), cash(200), rate("36.5123"))).toEqual({
      ok: true,
      value: cash(10000),
    });
  });

  it("a VES line of 10 × Bs. 365,12 at 36,51230000 costs $100,00 in total ($10,00 each)", () => {
    expect(computeInboundCostUsd(qty("10"), cash(36512, "VES"), rate("36.5123"))).toEqual({
      ok: true,
      value: cash(10000),
    });
  });

  it("converts the line subtotal, not a rounded unit cost, so no cent is lost per unit", () => {
    // Bs. 0,10 × 1000 units = Bs. 100,00; at 36,5123 that is $2,74 (a unit cost of $0,00 would give $0).
    expect(computeInboundCostUsd(qty("1000"), cash(10, "VES"), rate("36.5123"))).toEqual({
      ok: true,
      value: cash(274),
    });
  });
});

describe("computeUnitCostUsd", () => {
  it("divides total USD cost by quantity, rounding half away from zero", () => {
    expect(computeUnitCostUsd(cash(5000), qty("10"))).toEqual({ ok: true, value: cash(500) });
    // $10,00 / 3 = $3,3333… → $3,33; $10,00 / 6 = $1,6666… → $1,67
    expect(computeUnitCostUsd(cash(1000), qty("3"))).toEqual({ ok: true, value: cash(333) });
    expect(computeUnitCostUsd(cash(1000), qty("6"))).toEqual({ ok: true, value: cash(167) });
    // Fractional quantity: $301,00 / 150,5 kg = $2,00/kg
    expect(computeUnitCostUsd(cash(30100), qty("150.5"))).toEqual({ ok: true, value: cash(200) });
  });

  it("rejects non-USD or negative costs", () => {
    expect(computeUnitCostUsd(cash(100, "VES"), qty("1"))).toEqual({
      ok: false,
      error: "INVALID_COST",
    });
    expect(computeUnitCostUsd(cash(-1), qty("1"))).toEqual({
      ok: false,
      error: "INVALID_COST",
    });
  });
});

describe("buildStockLedger (ADR-007)", () => {
  const RECEIPT_1 = "33333333-3333-4333-8333-333333333331";
  const RECEIPT_2 = "33333333-3333-4333-8333-333333333332";

  it("10 units at $5,00 then 10 at $7,00 shows on-hand 10 → 20 and average $5,00 → $6,00", () => {
    const result = buildStockLedger(PRODUCT, [
      {
        id: "m1",
        documentDate: "2026-11-20",
        direction: "INBOUND",
        quantity: qty("10"),
        totalCostUsd: cash(5000),
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_1,
      },
      {
        id: "m2",
        documentDate: "2026-11-21",
        direction: "INBOUND",
        quantity: qty("10"),
        totalCostUsd: cash(7000),
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_2,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entries).toEqual([
      {
        id: "m1",
        documentDate: "2026-11-20",
        direction: "INBOUND",
        quantity: qty("10"),
        unitCostUsd: cash(500),
        averageCostAfterUsd: cash(500),
        onHandAfterScaled: 10_000n,
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_1,
      },
      {
        id: "m2",
        documentDate: "2026-11-21",
        direction: "INBOUND",
        quantity: qty("10"),
        unitCostUsd: cash(700),
        averageCostAfterUsd: cash(600),
        onHandAfterScaled: 20_000n,
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_2,
      },
    ]);
    expect(result.value.finalBalance.onHandScaled).toBe(20_000n);
    expect(result.value.finalBalance.totalValueUsd).toEqual(cash(12000));
  });

  it("returns empty entries and zero balance when there are no movements", () => {
    const result = buildStockLedger(PRODUCT, []);

    expect(result).toEqual({
      ok: true,
      value: { entries: [], finalBalance: zeroStockBalance(PRODUCT) },
    });
  });

  it("empties value and clears averageCostAfter when an outbound movement brings on-hand to zero", () => {
    const result = buildStockLedger(PRODUCT, [
      {
        id: "m1",
        documentDate: "2026-11-20",
        direction: "INBOUND",
        quantity: qty("3"),
        totalCostUsd: cash(1000),
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_1,
      },
      {
        id: "m2",
        documentDate: "2026-11-21",
        direction: "OUTBOUND",
        quantity: qty("3"),
        totalCostUsd: cash(1000),
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_2,
      },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entries[1]?.onHandAfterScaled).toBe(0n);
    expect(result.value.entries[1]?.averageCostAfterUsd).toBeNull();
    expect(result.value.finalBalance.totalValueUsd).toEqual(cash(0));
  });

  it("fails with INSUFFICIENT_STOCK if an outbound movement exceeds on-hand", () => {
    const result = buildStockLedger(PRODUCT, [
      {
        id: "m1",
        documentDate: "2026-11-20",
        direction: "OUTBOUND",
        quantity: qty("1"),
        totalCostUsd: cash(100),
        referenceType: "GOODS_RECEIPT",
        referenceId: RECEIPT_1,
      },
    ]);

    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_STOCK" });
  });
});
