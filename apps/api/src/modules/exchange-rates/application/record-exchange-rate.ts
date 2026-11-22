import type { CalendarDate } from "@cuadre/shared-kernel";
import {
  createExchangeRate,
  type ExchangeRateInput,
  type ExchangeRateRecord,
  type ExchangeRateValidationFailure,
} from "../domain/exchange-rate.ts";
import type { ExchangeRateRepository } from "./exchange-rate-repository.ts";

export type RecordExchangeRateResult =
  | { ok: true; value: ExchangeRateRecord }
  | { ok: false; error: "RATE_ALREADY_EXISTS"; date: CalendarDate }
  | { ok: false; error: "RATE_DATE_TOO_FAR"; date: CalendarDate }
  | ExchangeRateValidationFailure;

export async function recordExchangeRateUseCase(
  rates: ExchangeRateRepository,
  input: ExchangeRateInput,
  today: CalendarDate,
): Promise<RecordExchangeRateResult> {
  const rate = createExchangeRate(input, today);
  if (!rate.ok) return rate;
  const stored = await rates.insert(rate.value);
  if (stored.ok) return stored;
  return { ok: false, error: stored.error, date: rate.value.date };
}
