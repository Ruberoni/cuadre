import { z } from "zod";

/** Money on the wire (ADR-005): integer minor units + currency, never a JSON float. */
export const MoneyDto = z.object({
  minorUnits: z.number().int(),
  currency: z.enum(["USD", "VES"]),
});
export type MoneyDto = z.infer<typeof MoneyDto>;
