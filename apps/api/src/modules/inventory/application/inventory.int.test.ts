import { money, parseQuantity, parseRate, type Quantity } from "@cuadre/shared-kernel";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createInventoryModule, type InboundMovementInput } from "../index.ts";
import { stockMovementsTable } from "../infrastructure/inventory.table.ts";

const { db, close } = createDb(testDatabaseUrl());
const inventory = createInventoryModule({ db });

const HARINA = "11111111-1111-4111-8111-111111111111";
const ATUN = "22222222-2222-4222-8222-222222222222";
const RECEIPT = "33333333-3333-4333-8333-333333333333";

beforeEach(() => resetDatabase(db));
afterAll(close);

function qty(raw: string): Quantity {
  const parsed = parseQuantity(raw, { allowDecimals: true });
  if (!parsed.ok) throw new Error(`bad quantity ${raw}`);
  return parsed.value;
}

function line(
  productId: string,
  quantity: string,
  unitMinor: number,
  currency: "USD" | "VES" = "USD",
  rate = "36.5123",
): InboundMovementInput {
  const unitCost = money(unitMinor, currency);
  const frozenRate = parseRate(rate);
  if (!unitCost.ok || !frozenRate.ok) throw new Error("bad fixture");
  return {
    productId,
    quantity: qty(quantity),
    unitCost: unitCost.value,
    frozenRate: frozenRate.value,
    referenceType: "GOODS_RECEIPT",
    referenceId: RECEIPT,
    documentDate: "2026-11-24",
  };
}

async function record(...items: InboundMovementInput[]) {
  return db.transaction((tx) => inventory.recordInboundMovements(items, tx));
}

describe("inventory.recordInboundMovements", () => {
  it("10 units at $5,00 then 10 at $7,00 leaves 20 on hand at an average of $6,00 (ADR-007)", async () => {
    expect(await record(line(HARINA, "10", 500))).toEqual({ ok: true, value: true });
    expect(await record(line(HARINA, "10", 700))).toEqual({ ok: true, value: true });

    const balance = await inventory.getStockBalance(HARINA);
    expect(balance.onHandScaled).toBe(20_000n);
    expect(balance.totalValueUsd.minorUnits).toBe(12_000);
    expect(balance.roundedAverageCostUsd?.minorUnits).toBe(600);
  });

  it("keeps the exact value for 3 units at $10,00 in total and derives the average (no rounded average stored)", async () => {
    // 3 units, VES cost of Bs. 121,70 each at 36,5123: the subtotal Bs. 365,10 converts to $10,00.
    await record(line(HARINA, "3", 12170, "VES"));

    const balance = await inventory.getStockBalance(HARINA);
    expect(balance.totalValueUsd.minorUnits).toBe(1000);
    expect(balance.onHandScaled).toBe(3000n);
    expect(balance.averageCostUsd).toEqual({
      numeratorMinor: 1_000_000n,
      denominatorScaled: 3000n,
    });
  });

  it("accumulates several lines of the same product and writes one movement per line", async () => {
    await record(line(HARINA, "2", 100), line(ATUN, "1.5", 200), line(HARINA, "3", 300));

    const harina = await inventory.getStockBalance(HARINA);
    expect(harina.onHandScaled).toBe(5000n);
    expect(harina.totalValueUsd.minorUnits).toBe(200 + 900);
    const atun = await inventory.getStockBalance(ATUN);
    expect(atun.onHandScaled).toBe(1500n);
    expect(atun.totalValueUsd.minorUnits).toBe(300);

    const movements = await db.select().from(stockMovementsTable);
    expect(movements).toHaveLength(3);
    expect(movements.every((m) => m.direction === "INBOUND" && m.referenceId === RECEIPT)).toBe(
      true,
    );
  });

  it("leaves nothing behind when the caller's transaction fails (ADR-008)", async () => {
    await expect(
      db.transaction(async (tx) => {
        await inventory.recordInboundMovements([line(HARINA, "10", 500)], tx);
        throw new Error("the caller failed after raising stock");
      }),
    ).rejects.toThrow("the caller failed");

    expect((await inventory.getStockBalance(HARINA)).onHandScaled).toBe(0n);
    expect(await db.select().from(stockMovementsTable)).toHaveLength(0);
  });

  it("returns a Result and writes nothing when the stock would overflow", async () => {
    const result = await record(line(HARINA, "999999999999", 0), line(HARINA, "2", 0));

    expect(result).toEqual({ ok: false, error: "QUANTITY_OUT_OF_RANGE" });
    expect(await db.select().from(stockMovementsTable)).toHaveLength(0);
  });

  it("serializes concurrent receipts of the same products without losing value (deterministic lock order)", async () => {
    await Promise.all([
      record(line(HARINA, "1", 100), line(ATUN, "1", 100)),
      record(line(ATUN, "1", 100), line(HARINA, "1", 100)),
    ]);

    expect((await inventory.getStockBalance(HARINA)).totalValueUsd.minorUnits).toBe(200);
    expect((await inventory.getStockBalance(ATUN)).onHandScaled).toBe(2000n);
  });
});
