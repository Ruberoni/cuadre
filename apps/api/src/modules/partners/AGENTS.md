# AGENTS.md — `partners` module

Partners (`Partner`, `Supplier`, `Customer`): one `Partner` per `Rif` (`is_supplier`, `is_customer`). Follows the `catalog` template module. Root rules in [`/AGENTS.md`](../../../../../AGENTS.md) apply; this file only adds what is local.

## Layout

```
domain/           pure rules, no I/O: PartnerName, optional contact parsers, createSupplier, createCustomer, reconstitutePartner (uses Rif from @cuadre/shared-kernel)
application/      use cases (createSupplier, listSuppliers, createCustomer, listCustomers) + partner repository port
infrastructure/   partners.table.ts (Drizzle, schema `partners`), Drizzle repository, seed
http/             Hono/OpenAPI routes (`/suppliers`, `/customers`), shared DTO mapper, exhaustive error-to-status maps
index.ts          the ONLY public API: createPartnersModule({ db }) -> { routes, seed }
```

## Local rules

- **RIF single source of truth:** `Rif`, `parseRif`, and `computeRifCheckDigit` live in `@cuadre/shared-kernel` so API and Web share exact normalisation and modulus-11 check-digit validation.
- **Unique RIF across all partners & dual-role promotion:** `partners.partners` enforces uniqueness via `partners_rif_unique`. The repository inserts directly without check-then-insert and catches Postgres `23505` on `partners_rif_unique`:
  - If the existing row already holds the requested role, return `RIF_ALREADY_EXISTS` (409).
  - If the existing row only holds the other role and `confirmExistingPartner` is not set, return `PARTNER_ALREADY_EXISTS` (409) with the normalised `rif` and existing `partnerName` without mutating the row.
  - When `confirmExistingPartner: true` is passed, atomically flip the target role flag (`WHERE rif = $1 AND <role> = false`) keeping the existing legal name and contact fields untouched (200); if 0 rows match, return `RIF_ALREADY_EXISTS` (409).
- **Roles (`PLAN → Roles`):**
  - Suppliers (`/suppliers`): `admin` and `purchasing` read and write; `sales` and `warehouse` get 403.
  - Customers (`/customers`): `admin` and `sales` read and write; `purchasing` and `warehouse` get 403.
- **Row reconstitution:** repository reads rebuild entities via `reconstitutePartner` so corrupt DB rows fail loudly.
