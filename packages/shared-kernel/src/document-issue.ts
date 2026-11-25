// Pure document-issue rules shared across purchasing, sales and billing (ADR-005, ADR-013).
import { type CalendarDate, compareCalendarDates } from "./calendar-date.ts";
import { convert, type Money } from "./money.ts";
import type { Rate } from "./rate.ts";
import { err, ok, type Result } from "./result.ts";
import { invalid, type ValidationFailure } from "./validation.ts";

export type IssuePreconditionFailure =
  | { readonly ok: false; readonly error: "DOCUMENT_NOT_DRAFT" | "EMPTY_DOCUMENT" }
  | ValidationFailure<"documentDate", "DOCUMENT_DATE_IN_FUTURE">;

/**
 * Checks the lifecycle invariants required before issuing any commercial document (ADR-013):
 * 1. It must still be in `DRAFT` status.
 * 2. It must have at least one line (`EMPTY_DOCUMENT`).
 * 3. Its `DocumentDate` must not be in the future (`DOCUMENT_DATE_IN_FUTURE`).
 */
export function validateDocumentIssuePreconditions(input: {
  readonly status: "DRAFT" | "ISSUED";
  readonly documentDate: CalendarDate;
  readonly lineCount: number;
  readonly today: CalendarDate;
}): { readonly ok: true; readonly value: true } | IssuePreconditionFailure {
  if (input.status !== "DRAFT") {
    return err("DOCUMENT_NOT_DRAFT");
  }
  if (input.lineCount <= 0) {
    return err("EMPTY_DOCUMENT");
  }
  if (compareCalendarDates(input.documentDate, input.today) > 0) {
    return invalid([{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }]);
  }
  return ok(true);
}

/**
 * Computes the VES equivalent of a document total at its frozen BCV rate (ADR-005).
 * Returns `null` when the document is already denominated in `VES`.
 */
export function computeVesEquivalent(
  total: Money,
  frozenRate: Rate,
): Result<Money | null, "AMOUNT_OUT_OF_RANGE"> {
  if (total.currency === "VES") return ok(null);
  return convert(total, "VES", frozenRate);
}
