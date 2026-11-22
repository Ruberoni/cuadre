import { err, invalid, ok, type Result } from "@cuadre/shared-kernel";
import type { DbExecutor, DbTransaction } from "../../../db/client.ts";
import { parseCalendarDate } from "../domain/calendar-date.ts";
import type { ExchangeRateRecord, ExchangeRateValidationFailure } from "../domain/exchange-rate.ts";
import type { ExchangeRateRepository } from "./exchange-rate-repository.ts";

export type LookupExchangeRateResult =
  | Result<ExchangeRateRecord, "MISSING_EXCHANGE_RATE">
  | ExchangeRateValidationFailure;

export async function lookupExchangeRateUseCase(
  rates: ExchangeRateRepository,
  rawDate: string,
  tx?: DbExecutor,
): Promise<LookupExchangeRateResult> {
  const date = parseCalendarDate(rawDate);
  if (!date.ok) return invalid([{ field: "date", code: date.error }]);

  const found = await rates.findLatestOnOrBefore(date.value, tx);
  return found === undefined ? err("MISSING_EXCHANGE_RATE") : ok(found);
}

export async function lookupAndFreezeExchangeRateUseCase(
  rates: ExchangeRateRepository,
  rawDate: string,
  tx: DbTransaction,
): Promise<LookupExchangeRateResult> {
  const date = parseCalendarDate(rawDate);
  if (!date.ok) return invalid([{ field: "date", code: date.error }]);

  const found = await rates.findAndFreezeLatestOnOrBefore(date.value, tx);
  return found === undefined ? err("MISSING_EXCHANGE_RATE") : ok(found);
}
