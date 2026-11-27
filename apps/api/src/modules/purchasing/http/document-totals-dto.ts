import type { DocumentTotals as DocumentTotalsDto } from "@cuadre/contracts";
import type { DocumentTotals } from "@cuadre/shared-kernel";

/** The totals of any purchasing document as the API answers them (shared by purchase orders and receipts). */
export function toDocumentTotalsDto(totals: DocumentTotals): DocumentTotalsDto {
  const money = (value: { minorUnits: number; currency: "USD" | "VES" }) => ({
    minorUnits: value.minorUnits,
    currency: value.currency,
  });
  return {
    subtotal: money(totals.subtotal),
    ivaByRate: {
      general: money(totals.ivaByRate.general),
      reduced: money(totals.ivaByRate.reduced),
      exempt: money(totals.ivaByRate.exempt),
    },
    ivaTotal: money(totals.ivaTotal),
    total: money(totals.total),
  };
}
