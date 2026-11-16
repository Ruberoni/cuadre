# ADR-004: Postgres + Drizzle, module-owned tables

**Status:** Accepted

## Context
An ERP needs transactions, constraints and exact numerics. Agents generate more predictable and reviewable queries with a SQL-like, transparent ORM.

## Decision
- PostgreSQL as the only datastore.
- Drizzle ORM with versioned migrations committed to the repo.
- Each module owns its tables, declared in its `infrastructure/`. No module reads or joins another module's tables; it calls the owner's public API instead.
- Money columns use integer minor units or `numeric`, never floating point.

## Consequences
- Module boundaries hold at the data layer too.
- Some read models need composition in application code instead of SQL joins; acceptable at MVP scale.
