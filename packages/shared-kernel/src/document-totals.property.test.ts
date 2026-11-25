import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeDocumentTotals, type DocumentTotalsLine } from "./document-totals.ts";
import { applyPercentage, type Currency, money } from "./money.ts";
import { parseQuantity } from "./quantity.ts";
import { TAX_RATE_PERCENT, TAX_RATES, type TaxRate } from "./tax-rate.ts";

const currencyArb = fc.constantFrom<Currency>("USD", "VES");
const taxRateArb = fc.constantFrom<TaxRate>(...TAX_RATES);

function lineArb(currency: Currency): fc.Arbitrary<DocumentTotalsLine> {
  return fc
    .record({
      qtyMilli: fc.integer({ min: 1, max: 1_000_000 }),
      unitPriceMinor: fc.integer({ min: 1, max: 10_000_000 }),
      taxRate: taxRateArb,
    })
    .map(({ qtyMilli, unitPriceMinor, taxRate }) => {
      const whole = Math.floor(qtyMilli / 1000);
      const frac = String(qtyMilli % 1000).padStart(3, "0");
      const qty = parseQuantity(`${whole}.${frac}`, { allowDecimals: true });
      const price = money(unitPriceMinor, currency);
      if (!qty.ok || !price.ok) throw new Error("Arbitrary generated invalid line");
      return { quantity: qty.value, unitPrice: price.value, taxRate };
    });
}

describe("computeDocumentTotals properties (ADR-005)", () => {
  it("subtotal = sum(lines), IVA per rate = rounded rate * sum(lines of that rate), total = subtotal + IVA, all integer minor units", () => {
    fc.assert(
      fc.property(
        currencyArb.chain((currency) =>
          fc.tuple(fc.constant(currency), fc.array(lineArb(currency), { maxLength: 20 })),
        ),
        ([currency, lines]) => {
          const result = computeDocumentTotals(lines, currency);
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          const { lineTotals, subtotal, taxableBases, ivaByRate, ivaTotal, total } = result.value;

          // All amounts are safe integer minor units (never floats).
          for (const amount of [
            ...lineTotals,
            subtotal,
            taxableBases.general,
            taxableBases.reduced,
            taxableBases.exempt,
            ivaByRate.general,
            ivaByRate.reduced,
            ivaByRate.exempt,
            ivaTotal,
            total,
          ]) {
            expect(Number.isSafeInteger(amount.minorUnits)).toBe(true);
            expect(amount.currency).toBe(currency);
          }

          // subtotal = sum of line totals
          const sumLines = lineTotals.reduce((acc, item) => acc + item.minorUnits, 0);
          expect(subtotal.minorUnits).toBe(sumLines);

          // IVA of each rate equals rounded rate * sum(lines of that rate)
          const expectedGeneralIva = applyPercentage(
            taxableBases.general,
            TAX_RATE_PERCENT.GENERAL,
          );
          const expectedReducedIva = applyPercentage(
            taxableBases.reduced,
            TAX_RATE_PERCENT.REDUCED,
          );
          expect(expectedGeneralIva.ok && expectedReducedIva.ok).toBe(true);
          if (expectedGeneralIva.ok && expectedReducedIva.ok) {
            expect(ivaByRate.general.minorUnits).toBe(expectedGeneralIva.value.minorUnits);
            expect(ivaByRate.reduced.minorUnits).toBe(expectedReducedIva.value.minorUnits);
            expect(ivaByRate.exempt.minorUnits).toBe(0);
          }

          // ivaTotal = sum of IVA per rate
          expect(ivaTotal.minorUnits).toBe(
            ivaByRate.general.minorUnits +
              ivaByRate.reduced.minorUnits +
              ivaByRate.exempt.minorUnits,
          );

          // total = subtotal + ivaTotal
          expect(total.minorUnits).toBe(subtotal.minorUnits + ivaTotal.minorUnits);
        },
      ),
    );
  });
});
