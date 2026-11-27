import {
  EXCHANGE_RATE_DECIMALS,
  EXCHANGE_RATE_MAX_DAYS_AHEAD,
  EXCHANGE_RATE_MAX_INTEGER_DIGITS,
  type ExchangeRateField,
  type ExchangeRateIssueCode,
} from "@cuadre/contracts";
import {
  addDays,
  type CalendarDate,
  compareCalendarDates,
  err,
  type FieldIssue,
  invalid,
  ok,
  parseCalendarDate,
  parseRate,
  type Rate,
  type Result,
  type ValidationFailure,
} from "@cuadre/shared-kernel";

export type ExchangeRateInput = {
  readonly date: string;
  readonly rate: string;
};

export type ExchangeRateRecord = {
  readonly date: CalendarDate;
  readonly rate: Rate;
  readonly frozen: boolean;
};

type ExchangeRateFieldIssue = FieldIssue<ExchangeRateField, ExchangeRateIssueCode>;
export type ExchangeRateValidationFailure = ValidationFailure<
  ExchangeRateField,
  ExchangeRateIssueCode
>;

const UNSIGNED_DECIMAL = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const NEGATIVE_DECIMAL = /^-(0|[1-9]\d*)(?:\.(\d+))?$/;

/** Validates a wire rate string (`"36.5123"`) against domain and Postgres `numeric(20, 8)` rules. */
export function parseExchangeRateValue(raw: string): Result<Rate, ExchangeRateIssueCode> {
  const text = raw.trim();
  if (text === "") return err("REQUIRED");

  const match = UNSIGNED_DECIMAL.exec(text);
  if (match === null) {
    return NEGATIVE_DECIMAL.test(text) ? err("NOT_POSITIVE") : err("INVALID_FORMAT");
  }

  const [, integerPart = "", decimals = ""] = match;
  if (decimals.length > EXCHANGE_RATE_DECIMALS) return err("TOO_MANY_DECIMALS");
  if (integerPart.length > EXCHANGE_RATE_MAX_INTEGER_DIGITS) return err("OUT_OF_RANGE");

  const parsed = parseRate(text);
  if (!parsed.ok) return err("NOT_POSITIVE");
  return parsed;
}

/** Enforces recording rules for a new BCV rate, including the 7-day-ahead limit (ADR-005). */
export function createExchangeRate(
  input: ExchangeRateInput,
  today: CalendarDate,
):
  | { ok: true; value: ExchangeRateRecord }
  | { ok: false; error: "RATE_DATE_TOO_FAR"; date: CalendarDate }
  | ExchangeRateValidationFailure {
  const date = parseCalendarDate(input.date);
  const rate = parseExchangeRateValue(input.rate);

  const issues: ExchangeRateFieldIssue[] = [];
  if (!date.ok) issues.push({ field: "date", code: date.error });
  if (!rate.ok) issues.push({ field: "rate", code: rate.error });

  if (!date.ok || !rate.ok) return invalid(issues);

  const maxDate = addDays(today, EXCHANGE_RATE_MAX_DAYS_AHEAD);
  if (compareCalendarDates(date.value, maxDate) > 0) {
    return { ok: false, error: "RATE_DATE_TOO_FAR", date: date.value };
  }

  return ok({ date: date.value, rate: rate.value, frozen: false });
}

/** Rebuilds a stored row without the recording-time `today + 7` horizon check. */
export function reconstituteExchangeRate(input: {
  date: string;
  rate: string;
  frozen: boolean;
}): { ok: true; value: ExchangeRateRecord } | ExchangeRateValidationFailure {
  const date = parseCalendarDate(input.date);
  const rate = parseExchangeRateValue(input.rate);

  const issues: ExchangeRateFieldIssue[] = [];
  if (!date.ok) issues.push({ field: "date", code: date.error });
  if (!rate.ok) issues.push({ field: "rate", code: rate.error });

  if (!date.ok || !rate.ok) return invalid(issues);

  return ok({ date: date.value, rate: rate.value, frozen: input.frozen });
}

/** Updates an unfrozen rate value; frozen rates cannot be modified (ADR-005). */
export function correctExchangeRate(
  existing: ExchangeRateRecord,
  rateText: string,
):
  | { ok: true; value: ExchangeRateRecord }
  | { ok: false; error: "RATE_ALREADY_FROZEN"; date: CalendarDate }
  | ExchangeRateValidationFailure {
  if (existing.frozen) {
    return { ok: false, error: "RATE_ALREADY_FROZEN", date: existing.date };
  }
  const rate = parseExchangeRateValue(rateText);
  if (!rate.ok) return invalid([{ field: "rate", code: rate.error }]);
  return ok({ ...existing, rate: rate.value });
}

/** Pure reference lookup: greatest date `<= targetDate`, or `MISSING_EXCHANGE_RATE`. */
export function lookupRate(
  rates: readonly ExchangeRateRecord[],
  targetDate: CalendarDate,
): Result<ExchangeRateRecord, "MISSING_EXCHANGE_RATE"> {
  let best: ExchangeRateRecord | undefined;
  for (const candidate of rates) {
    if (compareCalendarDates(candidate.date, targetDate) <= 0) {
      if (best === undefined || compareCalendarDates(candidate.date, best.date) > 0) {
        best = candidate;
      }
    }
  }
  return best === undefined ? err("MISSING_EXCHANGE_RATE") : ok(best);
}

/** Pure reference lookup-and-freeze: marks exactly the returned rate frozen. */
export function lookupAndFreezeRate(
  rates: readonly ExchangeRateRecord[],
  targetDate: CalendarDate,
): Result<{ rate: ExchangeRateRecord; rates: ExchangeRateRecord[] }, "MISSING_EXCHANGE_RATE"> {
  const found = lookupRate(rates, targetDate);
  if (!found.ok) return found;
  const frozenRate: ExchangeRateRecord = { ...found.value, frozen: true };
  return ok({
    rate: frozenRate,
    rates: rates.map((item) => (item.date === found.value.date ? frozenRate : item)),
  });
}
