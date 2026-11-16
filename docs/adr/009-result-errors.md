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
