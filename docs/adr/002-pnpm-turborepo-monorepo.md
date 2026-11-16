# ADR-002: pnpm + Turborepo monorepo

**Status:** Accepted

## Context
The API and the web SPA share contracts (Zod schemas) and must evolve together; agents need one repo where a contract change and its consumers land in a single PR.

## Decision
A pnpm workspace orchestrated by Turborepo:
- `apps/api`, `apps/web`
- `packages/contracts` (shared Zod schemas), `packages/ui` (tokens + components), shared config packages as needed.

All packages are `"private": true` under the `@cuadre/*` scope; nothing is published to npm.

## Consequences
- One `pnpm typecheck` / `test` / `lint` across the whole system, cached by Turborepo.
- Contract changes break consumers at compile time in the same PR.
