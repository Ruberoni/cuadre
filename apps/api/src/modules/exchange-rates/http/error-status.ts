import type { CorrectExchangeRateResult } from "../application/correct-exchange-rate.ts";
import type { RecordExchangeRateResult } from "../application/record-exchange-rate.ts";

type RecordFailureCode = Extract<RecordExchangeRateResult, { ok: false }>["error"];
type CorrectFailureCode = Extract<CorrectExchangeRateResult, { ok: false }>["error"];

/** Exhaustive: a new failure code of the use case does not compile until it has a status. */
export const RECORD_EXCHANGE_RATE_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  RATE_DATE_TOO_FAR: 400,
  RATE_ALREADY_EXISTS: 409,
} as const satisfies Record<RecordFailureCode, 400 | 409>;

/** Exhaustive: a new failure code of the use case does not compile until it has a status. */
export const CORRECT_EXCHANGE_RATE_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_ALREADY_FROZEN: 409,
} as const satisfies Record<CorrectFailureCode, 400 | 404 | 409>;
