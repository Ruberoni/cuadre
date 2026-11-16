# ADR-008: Synchronous cross-module calls in one transaction

**Status:** Accepted

## Context
Some operations span modules: issuing an invoice (`sales`) must decrease stock (`inventory`); receiving goods (`purchasing`) must increase it. These must be atomic. Domain events or an outbox would decouple modules but hide the flow, which agents follow poorly.

## Decision
A use case calls other modules' public APIs **synchronously**, passing a shared unit of work so that all writes happen in **one database transaction**.

## Consequences
- Consistency is trivial and the flow is readable top to bottom.
- Modules are more coupled at runtime. Revisit with domain events or an outbox (new ADR) when a real need appears.
