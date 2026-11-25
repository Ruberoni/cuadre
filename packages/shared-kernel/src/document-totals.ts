// Document totals & IVA calculation (ADR-005): IVA is computed on the taxable base of each rate
// (sum of lines at that rate), never per line. Shared by purchasing, sales, invoices and web UI.
import {
  add,
  applyPercentage,
  type Currency,
  type Money,
  money,
  multiplyMoneyByQuantity,
} from "./money.ts";
import type { Quantity } from "./quantity.ts";
import { err, ok, type Result } from "./result.ts";
import { TAX_RATE_PERCENT, type TaxRate } from "./tax-rate.ts";

export type DocumentTotalsLine = {
  readonly quantity: Quantity;
  readonly unitPrice: Money;
  readonly taxRate: TaxRate;
};

export type DocumentTotals = {
  readonly lineTotals: readonly Money[];
  readonly subtotal: Money;
  readonly taxableBases: {
    readonly general: Money;
    readonly reduced: Money;
    readonly exempt: Money;
  };
  readonly ivaByRate: {
    readonly general: Money;
    readonly reduced: Money;
    readonly exempt: Money;
  };
  readonly ivaTotal: Money;
  readonly total: Money;
};

export type DocumentTotalsError = "CURRENCY_MISMATCH" | "AMOUNT_OUT_OF_RANGE";

function zero(currency: Currency): Money {
  const result = money(0, currency);
  if (!result.ok) throw new Error("zero money must always be valid");
  return result.value;
}

/**
 * Computes line subtotals, taxable bases per IVA rate, IVA per rate, subtotal, total IVA and grand
 * total using exact `Money` arithmetic (ADR-005).
 */
export function computeDocumentTotals(
  lines: readonly DocumentTotalsLine[],
  currency: Currency,
): Result<DocumentTotals, DocumentTotalsError> {
  const lineTotals: Money[] = [];
  let subtotal = zero(currency);
  let generalBase = zero(currency);
  let reducedBase = zero(currency);
  let exemptBase = zero(currency);

  for (const line of lines) {
    if (line.unitPrice.currency !== currency) return err("CURRENCY_MISMATCH");

    const lineTotal = multiplyMoneyByQuantity(line.unitPrice, line.quantity);
    if (!lineTotal.ok) return lineTotal;
    lineTotals.push(lineTotal.value);

    const nextSubtotal = add(subtotal, lineTotal.value);
    if (!nextSubtotal.ok) return nextSubtotal;
    subtotal = nextSubtotal.value;

    if (line.taxRate === "GENERAL") {
      const next = add(generalBase, lineTotal.value);
      if (!next.ok) return next;
      generalBase = next.value;
    } else if (line.taxRate === "REDUCED") {
      const next = add(reducedBase, lineTotal.value);
      if (!next.ok) return next;
      reducedBase = next.value;
    } else {
      const next = add(exemptBase, lineTotal.value);
      if (!next.ok) return next;
      exemptBase = next.value;
    }
  }

  const generalIva = applyPercentage(generalBase, TAX_RATE_PERCENT.GENERAL);
  if (!generalIva.ok) return err("AMOUNT_OUT_OF_RANGE");

  const reducedIva = applyPercentage(reducedBase, TAX_RATE_PERCENT.REDUCED);
  if (!reducedIva.ok) return err("AMOUNT_OUT_OF_RANGE");

  const exemptIva = zero(currency);

  const ivaGeneralPlusReduced = add(generalIva.value, reducedIva.value);
  if (!ivaGeneralPlusReduced.ok) return ivaGeneralPlusReduced;
  const ivaTotal = ivaGeneralPlusReduced.value;

  const total = add(subtotal, ivaTotal);
  if (!total.ok) return total;

  return ok({
    lineTotals,
    subtotal,
    taxableBases: {
      general: generalBase,
      reduced: reducedBase,
      exempt: exemptBase,
    },
    ivaByRate: {
      general: generalIva.value,
      reduced: reducedIva.value,
      exempt: exemptIva,
    },
    ivaTotal,
    total: total.value,
  });
}
