# AGENTS.md — `exchange-rates` module

Daily BCV exchange rates (`ExchangeRate`: `date`, 8-decimal `Rate`, `frozen` flag). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: parseExchangeRateValue, createExchangeRate, reconstituteExchangeRate, correctExchangeRate, lookupRate, lookupAndFreezeRate (uses CalendarDate from @cuadre/shared-kernel)
application/      use cases (record, correct, list, lookup, lookupAndFreeze) + repository port
infrastructure/   exchange-rates.table.ts (Drizzle, schema `exchange_rates`), Drizzle repository, seed
http/             Hono/OpenAPI routes + exhaustive error-to-status maps
index.ts          the ONLY public API: createExchangeRatesModule({ db, today? }) -> { routes, seed, lookupForDate, lookupAndFreezeForDate }
```

## Local rules

- **Exact 8-decimal rates (ADR-005):** stored as `numeric(20, 8)` (`12` integer digits max) and manipulated via `Rate` (`bigint` × 10⁸) from `@cuadre/shared-kernel`. Never convert to JS `number`.
- **7-day-ahead recording horizon (ADR-005):** `createExchangeRate` rejects `date > addDays(today, 7)` with `RATE_DATE_TOO_FAR`. DB reads use `reconstituteExchangeRate`, never `createExchangeRate`, so reads do not depend on `today`.
- **Freezing & ADR-008 transactions:** `lookupAndFreezeForDate(date, tx)` requires a `DbTransaction` (`tx`) so issuing use cases always freeze the rate inside the same DB transaction as the document write. `lookupForDate(date, tx?)` accepts an optional `DbExecutor`.
- **Race-safe writes:** `insert` catches Postgres `23505` on `rates_pkey` → `RATE_ALREADY_EXISTS`. `updateRate` updates atomically `WHERE date = $1 AND frozen = false` and disambiguates `NOT_FOUND` vs `RATE_ALREADY_FROZEN`.
