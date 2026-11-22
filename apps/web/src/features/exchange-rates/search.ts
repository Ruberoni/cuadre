import { z } from "zod";

export const exchangeRatesSearchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  registrar: z.boolean().optional().catch(undefined),
});

export type ExchangeRatesSearch = z.output<typeof exchangeRatesSearchSchema>;

export const defaultExchangeRatesSearch = {
  page: 1,
} as const satisfies ExchangeRatesSearch;
