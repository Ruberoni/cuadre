// Keep imports from this file relative with `.ts`: scripts/generate-tokens.ts imports it and runs
// under Node's type stripping, which does not resolve the `@/` alias.
/** Expected failures are values, not exceptions (ADR-009). */
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

export const err = <E extends string>(error: E): { ok: false; error: E } => ({ ok: false, error });
