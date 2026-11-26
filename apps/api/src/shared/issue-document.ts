// Generic transactional document-issue coordinator shared across commercial document modules
// (ADR-001, ADR-008, ADR-009, ADR-013; REVIEW.md item 11). Uses injected ports only — never
// imports module internals or Drizzle tables.
import type { CalendarDate, Rate, Result, ValidationFailure } from "@cuadre/shared-kernel";
import type { Db, DbTransaction } from "../db/client.ts";

export type LookupAndFreezeRateResult =
  | Result<{ readonly rate: Rate }, "MISSING_EXCHANGE_RATE">
  | ValidationFailure<string, string>;

export type IssueDocumentResult<
  TIssued,
  TLockError extends { readonly ok: false; readonly error: string } = never,
  TPersistError extends { readonly ok: false; readonly error: string } = never,
> =
  | { readonly ok: true; readonly value: TIssued }
  | TLockError
  | TPersistError
  | { readonly ok: false; readonly error: "MISSING_EXCHANGE_RATE"; readonly date: CalendarDate }
  | ValidationFailure<string, string>;

class AbortIssueTransaction extends Error {
  readonly failure: { readonly ok: false; readonly error: string };

  constructor(failure: { readonly ok: false; readonly error: string }) {
    super("AbortIssueTransaction");
    this.failure = failure;
  }
}

/**
 * Coordinates issuing any commercial document inside a single database transaction:
 * 1. Locks and validates the document (`lockAndValidate`).
 * 2. Looks up and freezes the BCV rate for its `DocumentDate` (`lookupAndFreezeForDate`).
 * 3. Persists the issued state and any downstream module effects (`persistIssued`).
 *
 * Any expected failure aborts the transaction (rolling back any rate freeze or writes) and
 * returns the typed failure `Result` without throwing.
 */
export async function issueDocument<
  TDoc extends { readonly documentDate: CalendarDate },
  TIssued,
  TLockError extends { readonly ok: false; readonly error: string } = never,
  TPersistError extends { readonly ok: false; readonly error: string } = never,
>(params: {
  readonly db: Db;
  readonly today: CalendarDate;
  readonly lookupAndFreezeForDate: (
    date: CalendarDate,
    tx: DbTransaction,
  ) => Promise<LookupAndFreezeRateResult>;
  readonly lockAndValidate: (
    tx: DbTransaction,
    today: CalendarDate,
  ) => Promise<{ readonly ok: true; readonly value: TDoc } | TLockError>;
  readonly persistIssued: (
    doc: TDoc,
    frozenRate: Rate,
    tx: DbTransaction,
  ) => Promise<{ readonly ok: true; readonly value: TIssued } | TPersistError>;
}): Promise<IssueDocumentResult<TIssued, TLockError, TPersistError>> {
  try {
    return await params.db.transaction(async (tx) => {
      const locked = await params.lockAndValidate(tx, params.today);
      if (!locked.ok) {
        throw new AbortIssueTransaction(locked);
      }

      const rateResult = await params.lookupAndFreezeForDate(locked.value.documentDate, tx);
      if (!rateResult.ok) {
        if (rateResult.error === "MISSING_EXCHANGE_RATE") {
          throw new AbortIssueTransaction({
            ok: false,
            error: "MISSING_EXCHANGE_RATE",
            date: locked.value.documentDate,
          } as {
            readonly ok: false;
            readonly error: "MISSING_EXCHANGE_RATE";
            readonly date: CalendarDate;
          });
        }
        throw new AbortIssueTransaction(rateResult);
      }

      const persisted = await params.persistIssued(locked.value, rateResult.value.rate, tx);
      if (!persisted.ok) {
        throw new AbortIssueTransaction(persisted);
      }

      return { ok: true, value: persisted.value };
    });
  } catch (error) {
    if (error instanceof AbortIssueTransaction) {
      return error.failure as IssueDocumentResult<TIssued, TLockError, TPersistError>;
    }
    throw error;
  }
}
