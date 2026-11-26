import { z } from "zod";
import { MoneyDto } from "../money.ts";

/** Totals shared by every purchasing document: IVA is computed on the taxable base of each rate. */
export const DocumentTotals = z.object({
  subtotal: MoneyDto,
  ivaByRate: z.object({
    general: MoneyDto,
    reduced: MoneyDto,
    exempt: MoneyDto,
  }),
  ivaTotal: MoneyDto,
  total: MoneyDto,
});
export type DocumentTotals = z.infer<typeof DocumentTotals>;
