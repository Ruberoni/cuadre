# ADR-009: Domain errors as Result

**Status:** Accepted

## Context
Business failures (insufficient stock, missing exchange rate, invoice already paid) are expected outcomes, not exceptions. When they are thrown, the type system cannot force callers, agents included, to handle them.

## Decision
Domain functions and use cases return a discriminated union:

```ts
type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
```

Error codes are string literals (e.g. `INSUFFICIENT_STOCK`). Mapping to HTTP status codes happens in one place in the HTTP layer. Exceptions are reserved for unexpected failures (bugs, DB down).

## Consequences
- Every expected failure is visible in function signatures and must be handled.
- Slightly more verbose than throwing.

## Amendment (2026-11-17): validation failures carry field issues

A use case that validates user input can fail on several fields at once, and a single error code cannot say which. `packages/shared-kernel` adds `ValidationFailure<Field, Code>`, built with `invalid(issues)`:

```ts
type ValidationFailure<F, C> = { ok: false; error: "VALIDATION_ERROR"; issues: readonly { field: F; code: C }[] };
```

It has the same shape as a failed `Result` (`ok: false` + `error`), so a use case returns `Result<T, E> | ValidationFailure<F, C>` and callers discriminate on `error`. The HTTP layer maps `VALIDATION_ERROR` to 400 with the issues in the body; every other code stays a plain string. Introduced by the catalog slice (#7); proposed to the maintainer in that PR.
