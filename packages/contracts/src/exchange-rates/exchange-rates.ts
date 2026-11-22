import { z } from "zod";
import { ROLES, type Role } from "../auth/session.ts";

// Rule constants: the single source for the domain, the API and the web form.
export const EXCHANGE_RATES_PAGE_SIZE = 25;
/** BCV publishes the next business day's rate in advance; holidays can stretch the gap (ADR-005). */
export const EXCHANGE_RATE_MAX_DAYS_AHEAD = 7;
/** Matches `numeric(20, 8)` in Postgres: 12 integer digits and 8 decimal digits. */
export const EXCHANGE_RATE_MAX_INTEGER_DIGITS = 12;
export const EXCHANGE_RATE_DECIMALS = 8;

/** Who may call the exchange-rate routes (PLAN → Roles): admin writes, every role reads. */
export const EXCHANGE_RATE_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ROLES,
  write: ["admin"],
};

export const EXCHANGE_RATE_FIELDS = ["date", "rate"] as const;
export type ExchangeRateField = (typeof EXCHANGE_RATE_FIELDS)[number];

export const EXCHANGE_RATE_ISSUE_CODES = [
  "REQUIRED",
  "INVALID_DATE",
  "INVALID_FORMAT",
  "TOO_MANY_DECIMALS",
  "NOT_POSITIVE",
  "OUT_OF_RANGE",
  "INVALID",
] as const;
export type ExchangeRateIssueCode = (typeof EXCHANGE_RATE_ISSUE_CODES)[number];

/** Wire shape only; calendar date and rate rules are enforced by the domain. */
export const RecordExchangeRateRequest = z.object({
  date: z.string(),
  rate: z.string(),
});
export type RecordExchangeRateRequest = z.infer<typeof RecordExchangeRateRequest>;

export const CorrectExchangeRateRequest = z.object({
  rate: z.string(),
});
export type CorrectExchangeRateRequest = z.infer<typeof CorrectExchangeRateRequest>;

export const ExchangeRateDateParam = z.object({
  date: z.string(),
});
export type ExchangeRateDateParam = z.infer<typeof ExchangeRateDateParam>;

/** Rate is always an 8-decimal dot string (`"36.51230000"`), never a JSON float (ADR-005). */
export const ExchangeRate = z.object({
  date: z.string(),
  rate: z.string(),
  frozen: z.boolean(),
});
export type ExchangeRate = z.infer<typeof ExchangeRate>;

export const ListExchangeRatesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
});
export type ListExchangeRatesQuery = z.infer<typeof ListExchangeRatesQuery>;

export const ListExchangeRatesResponse = z.object({
  items: z.array(ExchangeRate),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListExchangeRatesResponse = z.infer<typeof ListExchangeRatesResponse>;

export const CurrentExchangeRateResponse = z.object({
  rate: ExchangeRate.nullable(),
});
export type CurrentExchangeRateResponse = z.infer<typeof CurrentExchangeRateResponse>;
