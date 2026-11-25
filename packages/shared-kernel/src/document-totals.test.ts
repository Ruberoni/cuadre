import { describe, expect, it } from "vitest";
import { computeDocumentTotals } from "./document-totals.ts";
import { money } from "./money.ts";
import { parseQuantity } from "./quantity.ts";

function mustMoney(minorUnits: number, currency: "USD" | "VES") {
  const result = money(minorUnits, currency);
  if (!result.ok) throw new Error(`Invalid money: ${minorUnits}`);
  return result.value;
}

function mustQty(raw: string, allowDecimals = false) {
  const result = parseQuantity(raw, { allowDecimals });
  if (!result.ok) throw new Error(`Invalid quantity: ${raw}`);
  return result.value;
}

describe("computeDocumentTotals", () => {
  it("computes USD mixed IVA totals (AC #1: 100 x $1.10 Exempt + 50 x $2.00 General 16%)", () => {
    const result = computeDocumentTotals(
      [
        { quantity: mustQty("100"), unitPrice: mustMoney(110, "USD"), taxRate: "EXEMPT" },
        { quantity: mustQty("50"), unitPrice: mustMoney(200, "USD"), taxRate: "GENERAL" },
      ],
      "USD",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lineTotals.map((m) => m.minorUnits)).toEqual([11000, 10000]);
    expect(result.value.subtotal.minorUnits).toBe(21000);
    expect(result.value.ivaByRate.general.minorUnits).toBe(1600);
    expect(result.value.ivaByRate.reduced.minorUnits).toBe(0);
    expect(result.value.ivaByRate.exempt.minorUnits).toBe(0);
    expect(result.value.ivaTotal.minorUnits).toBe(1600);
    expect(result.value.total.minorUnits).toBe(22600);
  });

  it("computes IVA on the taxable base of each rate, not per line (AC #3: three $0.03 16% lines -> $0.01)", () => {
    const result = computeDocumentTotals(
      [
        { quantity: mustQty("1"), unitPrice: mustMoney(3, "USD"), taxRate: "GENERAL" },
        { quantity: mustQty("1"), unitPrice: mustMoney(3, "USD"), taxRate: "GENERAL" },
        { quantity: mustQty("1"), unitPrice: mustMoney(3, "USD"), taxRate: "GENERAL" },
      ],
      "USD",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subtotal.minorUnits).toBe(9);
    expect(result.value.ivaByRate.general.minorUnits).toBe(1);
    expect(result.value.ivaTotal.minorUnits).toBe(1);
    expect(result.value.total.minorUnits).toBe(10);
  });

  it("handles empty lines (draft with no lines)", () => {
    const result = computeDocumentTotals([], "USD");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subtotal.minorUnits).toBe(0);
    expect(result.value.ivaTotal.minorUnits).toBe(0);
    expect(result.value.total.minorUnits).toBe(0);
  });

  it("computes VES totals with decimal quantities and reduced 8% IVA", () => {
    const result = computeDocumentTotals(
      [
        {
          quantity: mustQty("12.345", true),
          unitPrice: mustMoney(1000, "VES"),
          taxRate: "REDUCED",
        },
      ],
      "VES",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 12.345 * 10.00 Bs = 123.45 Bs (12345 minor units); 8% of 12345 = 987.6 -> 988
    expect(result.value.subtotal.currency).toBe("VES");
    expect(result.value.subtotal.minorUnits).toBe(12345);
    expect(result.value.ivaByRate.reduced.minorUnits).toBe(988);
    expect(result.value.total.minorUnits).toBe(13333);
  });

  it("rejects lines with a different currency than the document", () => {
    const result = computeDocumentTotals(
      [{ quantity: mustQty("1"), unitPrice: mustMoney(100, "VES"), taxRate: "GENERAL" }],
      "USD",
    );
    expect(result).toEqual({ ok: false, error: "CURRENCY_MISMATCH" });
  });
});
