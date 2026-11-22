// The only public API of the exchange-rates module (ADR-001): other code imports from here,
// never from domain/, application/, infrastructure/ or http/.
import { type CalendarDate, parseCalendarDate, todayCaracas } from "@cuadre/shared-kernel";
import type { Db, DbExecutor, DbTransaction } from "../../db/client.ts";
import {
  lookupAndFreezeExchangeRateUseCase,
  lookupExchangeRateUseCase,
} from "./application/lookup-exchange-rate.ts";
import { createExchangeRateRoutes } from "./http/exchange-rates.routes.ts";
import { createDrizzleExchangeRateRepository } from "./infrastructure/drizzle-exchange-rate-repository.ts";
import { seedExchangeRates } from "./infrastructure/seed-exchange-rates.ts";

export function createExchangeRatesModule({
  db,
  today = todayCaracas,
}: {
  db: Db;
  today?: () => string;
}) {
  const rates = createDrizzleExchangeRateRepository(db);
  const currentToday = (): CalendarDate => {
    const parsed = parseCalendarDate(today());
    if (!parsed.ok) throw new Error("today() must return a YYYY-MM-DD calendar date");
    return parsed.value;
  };
  return {
    /** Mounted by the app under `/api`. */
    routes: createExchangeRateRoutes(rates, currentToday),
    /** Loads the fictitious demo BCV rates; safe to run again. */
    seed: () => seedExchangeRates(rates, currentToday()),
    /** Plain lookup for a date (ADR-005); accepts an optional transaction (ADR-008). */
    lookupForDate: (date: string, tx?: DbExecutor) => lookupExchangeRateUseCase(rates, date, tx),
    /** Look up and freeze the rate inside the caller's transaction (ADR-005, ADR-008). */
    lookupAndFreezeForDate: (date: string, tx: DbTransaction) =>
      lookupAndFreezeExchangeRateUseCase(rates, date, tx),
  };
}

export type ExchangeRatesModule = ReturnType<typeof createExchangeRatesModule>;
