import type { PurchaseOrder } from "@cuadre/contracts";
import type { Currency } from "@cuadre/shared-kernel";
import { formatBcvRate, formatMoney } from "@/lib/format";
import { purchaseOrdersMessages } from "@/messages";

export function TotalsCard({
  currency,
  subtotal,
  ivaGeneral,
  ivaReduced,
  total,
  frozenRate,
  vesTotalEquivalent,
}: {
  currency: Currency;
  subtotal: number;
  ivaGeneral: number;
  ivaReduced: number;
  total: number;
  frozenRate?: string | null;
  vesTotalEquivalent?: PurchaseOrder["vesTotalEquivalent"];
}) {
  const t = purchaseOrdersMessages.form.totals;
  return (
    <div className="ml-auto w-96 rounded-md border border-border p-4">
      <dl className="flex flex-col gap-2 text-body">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t.subtotal}</dt>
          <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
        </div>
        {ivaGeneral > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.ivaGeneral}</dt>
            <dd className="tabular-nums">{formatMoney(ivaGeneral, currency)}</dd>
          </div>
        ) : null}
        {ivaReduced > 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.ivaReduced}</dt>
            <dd className="tabular-nums">{formatMoney(ivaReduced, currency)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <dt>{t.total}</dt>
          <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
        </div>
        {frozenRate !== undefined &&
        frozenRate !== null &&
        vesTotalEquivalent !== undefined &&
        vesTotalEquivalent !== null ? (
          <>
            <div className="flex justify-between border-t border-border pt-2 text-muted-foreground">
              <dt>{t.frozenRate}</dt>
              <dd className="tabular-nums">{formatBcvRate(frozenRate)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>{t.vesEquivalent}</dt>
              <dd className="tabular-nums">
                {formatMoney(vesTotalEquivalent.minorUnits, vesTotalEquivalent.currency)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
