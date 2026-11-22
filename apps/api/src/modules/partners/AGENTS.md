# AGENTS.md — `partners` module

Partners (`Partner`, `Supplier`, and future `Customer`): one `Partner` per `Rif` (`is_supplier`, `is_customer`). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: PartnerName, optional contact parsers, createSupplier, reconstitutePartner (uses Rif from @cuadre/shared-kernel)
application/      use cases (createSupplier, listSuppliers) + partner repository port
infrastructure/   partners.table.ts (Drizzle, schema `partners`), Drizzle repository, seed
http/             Hono/OpenAPI routes (`/suppliers`) + exhaustive error-to-status map
index.ts          the ONLY public API: createPartnersModule({ db }) -> { routes, seed }
```

## Local rules

- **RIF single source of truth:** `Rif`, `parseRif`, and `computeRifCheckDigit` live in `@cuadre/shared-kernel` so API and Web share exact normalisation and modulus-11 check-digit validation.
- **Unique RIF across all partners:** `partners.partners` enforces uniqueness via `partners_rif_unique`. The repository maps Postgres `23505` on `partners_rif_unique` to `RIF_ALREADY_EXISTS`; never check-then-insert.
- **Roles (`PLAN → Roles`):** `admin` and `purchasing` read and write suppliers; `sales` and `warehouse` have no access (403).
- **Row reconstitution:** repository reads rebuild entities via `reconstitutePartner` so corrupt DB rows fail loudly.
