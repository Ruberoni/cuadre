# ADR-001: Modular monolith

**Status:** Accepted

## Context
Cuadre is a one-person project developed mostly by AI agents. Agents work best on a bounded context they can read in full, with boundaries enforced mechanically rather than by review. Microservices would add deployment and consistency costs with no benefit at this scale; a layered "controllers/services/repos" app degrades into coupling when many agents touch everything.

## Decision
One deployable backend (`apps/api`) composed of modules per bounded context: `catalog`, `partners`, `purchasing`, `inventory`, `sales`, `billing`, `exchange-rates`.

Each module has `domain/`, `application/` (one use case per file), `infrastructure/`, `http/`, an `index.ts` that is its only public API, and its own `AGENTS.md`.

Boundaries are enforced in CI with dependency-cruiser:
- other modules import only `modules/<x>/index.ts`;
- `domain/` imports no I/O (Drizzle, Hono, `infrastructure/`, `http/`).

## Consequences
- An issue has an obvious home; agents can load one module as context.
- Violations fail CI instead of relying on human review.
- Extracting a module into a service later remains possible but is not planned.
