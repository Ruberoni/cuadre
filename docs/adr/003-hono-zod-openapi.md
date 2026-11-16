# ADR-003: Hono + zod-openapi for the API

**Status:** Accepted

## Context
The API contract must be a single source of truth: changing an endpoint carelessly should break the frontend typecheck, not production. Alternatives considered: Express 5 (best agent familiarity, but untyped request/response without extra layers), Hapi (declining ecosystem, weaker typing), Fastify (mature but less ergonomic with Zod), NestJS (decorator ceremony that agents replicate without judgment).

## Decision
Use Hono with `@hono/zod-openapi`. Routes are declared with Zod schemas, which provide validation, inferred types and an OpenAPI spec. The web client is generated from (or typed by) that spec.

## Consequences
- Request/response types flow end to end without hand-written duplicates.
- OpenAPI documentation comes for free.
- Smaller ecosystem than Express; acceptable for this project.
