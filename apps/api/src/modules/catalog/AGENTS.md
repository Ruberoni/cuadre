# AGENTS.md — `catalog` module

Products: create and list (edit is #36). This is the **template module**: copy its layout and patterns for the next one, and keep it the reference when a pattern changes. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: value objects (Sku, ProductName, UnitOfMeasure, TaxRate) and createProduct
application/      one use case per file + the repository port (a type), no Drizzle
infrastructure/   *.table.ts (Drizzle, schema `catalog`), the Drizzle repository, the seed
http/             Hono/OpenAPI routes + the error-to-status map
index.ts          the ONLY public API: createCatalogModule({ db }) -> { routes, seed }
```

Dependency direction: `http → application → domain`, and `infrastructure → application (port) → domain`. Nothing imports `http` or `infrastructure` except `index.ts`.

## Where each rule lives

- **Field rules** (SKU pattern, max lengths, units, IVA rates, page size) are constants in `packages/contracts` (`catalog/products.ts`). The domain enforces them, the web form imports the same constants. Change a rule there, never in two places. The table's `CHECK` constraints are built from the same constants, so changing a rule also means regenerating the migration (`db:generate`).
- **Business rules** live in `domain/` and are written test-first. Value objects are branded strings built by `parseX(raw): Result<X, Code>`; `createProduct` runs them all and reports every invalid field at once.
- **Wire shape** (types, enums, USD price) is the contracts' Zod schema; the API turns shape failures into the same `VALIDATION_ERROR` + `issues` body as domain failures. Shape failures come first: a body that breaks the shape never reaches the domain, so it lists only the shape's fields (one issue per field), and a body that is not an object has no `issues`.

## Errors (ADR-009 and its amendment)

- Use cases return a discriminated union, never throw for expected failures: `{ ok: true; value } | { ok: false; error: "SKU_ALREADY_EXISTS"; sku } | ValidationFailure`.
- Validation failures use `invalid(issues)` from `@cuadre/shared-kernel` (`FieldIssue = { field, code }`). Field and issue codes are string-literal unions exported by contracts (`ProductField`, `ProductIssueCode`).
- `http/error-status.ts` maps every failure code to a status with an exhaustive `Record`: a new code does not compile until mapped. Bodies are built with `errorBody` from `src/http/api-error.ts`.
- A new error code also needs: an entry in contracts' `API_ERROR_CODES` and a message in the web message catalog.
- Race-safe uniqueness: the unique index is the rule; the repository maps Postgres `23505` **on that constraint** (`products_sku_unique`) to `SKU_ALREADY_EXISTS`; any other violation stays an unexpected error. Never check-then-insert.

## Persistence

- Tables live in the module's own Postgres schema (`pgSchema("catalog")`), in `infrastructure/*.table.ts`; never query another module's tables (use its `index.ts`).
- Money is `sale_price_minor` (bigint, integer minor units) + `sale_price_currency`; rows are rebuilt through `createProduct`, so a corrupt row fails loudly.
- Codes sort with `collate "C"` so the order is the same on every database. Names sort with the database's own collation (a known assumption: it can differ between machines); pin one when it matters.
- A new module adds its schema to `schemaFilter` in `apps/api/drizzle.config.ts`.
- A schema change: edit the table, run `pnpm --filter @cuadre/api db:generate`, commit the SQL. Never edit an existing migration.

## Adding a use case, route or table

1. Domain rule first, as a failing unit test (`*.test.ts` next to the file).
2. Use case in `application/<name>.ts` taking the repository port; extend the port in `product-repository.ts` if needed and implement it in `infrastructure/`.
3. Wire shape in `packages/contracts`; route in `http/` with `createRoute` (every response status declared, errors as `ApiError`); status map entry; `new OpenAPIHono(openApiOptions)` so the validation hook applies.
   **Roles:** every route declares who may call it, `middleware: [allowRoles(PRODUCT_ROLES.write)] as const` (`src/auth/roles.ts`; the lists live in contracts so the web hides with the same ones), and spreads `forbiddenResponse` into its `responses`. A route without it answers 403 to everyone and fails `roles.int.test.ts`.
4. Integration test (`*.int.test.ts`, real Postgres, `resetDatabase(db)` in `beforeEach`) per acceptance example, plus one `expectAllowedRoles(...)` line per route with the roles written out (REVIEW item 6).

## Tests

- Unit (`*.test.ts`): domain only, no I/O.
- Integration (`*.int.test.ts`): use cases and HTTP (`createApp({ db }).request(...)`) against the `cuadre_test` database.
- Seed data goes through the use case, so it obeys every rule, and is idempotent.

## Not shown by this template yet

Transactions across use cases (ADR-008) and calls into another module. Integration tests sign in with `test/sign-in.ts` (one role) or `test/roles.ts` (all four). The first module that needs one extends this file.
