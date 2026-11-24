import { z } from "zod";

export const CurrencySchema = z.enum(["USD", "VES"]);

/** Money on the wire (ADR-005): integer minor units + currency, never a JSON float. */
export const MoneyDto = z.object({
  minorUnits: z.number().int(),
  currency: CurrencySchema,
});
export type MoneyDto = z.infer<typeof MoneyDto>;
