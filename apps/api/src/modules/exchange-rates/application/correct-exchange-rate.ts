import { type CalendarDate, invalid, parseCalendarDate } from "@cuadre/shared-kernel";
import {
  type ExchangeRateRecord,
  type ExchangeRateValidationFailure,
  parseExchangeRateValue,
} from "../domain/exchange-rate.ts";
import type { ExchangeRateRepository } from "./exchange-rate-repository.ts";

export type CorrectExchangeRateResult =
  | { ok: true; value: ExchangeRateRecord }
  | { ok: false; error: "NOT_FOUND"; date: CalendarDate }
  | { ok: false; error: "RATE_ALREADY_FROZEN"; date: CalendarDate }
  | ExchangeRateValidationFailure;

export async function correctExchangeRateUseCase(
  rates: ExchangeRateRepository,
  input: { date: string; rate: string },
): Promise<CorrectExchangeRateResult> {
  const date = parseCalendarDate(input.date);
  const rate = parseExchangeRateValue(input.rate);
  if (!date.ok || !rate.ok) {
    const issues = [
      ...(date.ok ? [] : [{ field: "date" as const, code: date.error }]),
      ...(rate.ok ? [] : [{ field: "rate" as const, code: rate.error }]),
    ];
    return invalid(issues);
  }

  const updated = await rates.updateRate(date.value, rate.value);
  if (updated.ok) return updated;
  return { ok: false, error: updated.error, date: date.value };
}
