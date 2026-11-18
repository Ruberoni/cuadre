import { TAX_RATES, type TaxRate } from "@cuadre/contracts";
import { err, ok, type Result } from "@cuadre/shared-kernel";

export type { TaxRate };

export function parseTaxRate(raw: string): Result<TaxRate, "INVALID"> {
  const rate = TAX_RATES.find((candidate) => candidate === raw);
  return rate === undefined ? err("INVALID") : ok(rate);
}
