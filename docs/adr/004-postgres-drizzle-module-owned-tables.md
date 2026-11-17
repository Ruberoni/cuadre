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

## Amendment (2026-11-17): one Postgres schema per module

Each module's tables live in a Postgres schema of its own, named after the module (`pgSchema("catalog")` gives `catalog.products`). Ownership is then visible in raw SQL, where dependency-cruiser cannot see it (REVIEW item 2), and test helpers can reset every module generically. `drizzle.config.ts` lists the schemas in `schemaFilter`. Introduced by the catalog slice (#7); proposed to the maintainer in that PR.
