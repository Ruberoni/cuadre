/**
 * A use case that validates input can fail on several fields at once, which `Result<T, E>` (a
 * single error code) cannot say. `ValidationFailure` keeps the discriminated-union shape of
 * ADR-009 (`ok: false` + `error`) and adds the field issues. Amends ADR-009.
 */
export type FieldIssue<Field extends string, Code extends string> = {
  readonly field: Field;
  readonly code: Code;
};

export type ValidationFailure<Field extends string = string, Code extends string = string> = {
  readonly ok: false;
  readonly error: "VALIDATION_ERROR";
  readonly issues: readonly FieldIssue<Field, Code>[];
};

export const invalid = <Field extends string, Code extends string>(
  issues: readonly FieldIssue<Field, Code>[],
): ValidationFailure<Field, Code> => ({ ok: false, error: "VALIDATION_ERROR", issues });
