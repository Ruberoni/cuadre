# REVIEW.md — Cuadre

Focus for whoever reviews a PR (the maintainer or `/code-review`). See [ADR-014](docs/adr/014-verification-layer.md).

## How to use

1. Read the diff and run **only the checklist items whose trigger matches**. Report each triggered item as passed or failed, with the reason.
2. Do not re-check what tooling already enforces in CI (types, Biome, dependency-cruiser imports, tests). Focus on what tools cannot see.
3. Tag findings **Important**, **Nit** or **Pre-existing**. Pre-existing problems are not held against the PR.
4. Check that the PR's **Verification** section and `Verified-by:` trailer match what was actually run.

## Reliability checklist

Each item: **trigger** (readable from the diff) → **check** → origin. New items come from `escaped-defect` issues; prune items that no longer catch anything.

1. **Money** — amounts, prices or rates change → only `Money` operations; no `number`, `parseFloat` or float math for money; rates keep exactly 8 decimals. _ADR-005._
2. **Data access** — queries or repositories change → no query reads or writes another module's tables (dependency-cruiser sees imports, not SQL). _ADR-001, ADR-004._
3. **Documents** — an `issue…` use case or a new document type → side effects (rate freeze, stock, balances, numbering) happen only when issuing, inside one transaction; `Issued` documents are never updated or deleted; the rate comes from the `DocumentDate` lookup and fails with `MISSING_EXCHANGE_RATE`; `DocumentDate` is never in the future. _ADR-005, ADR-008, ADR-013._
4. **IGTF** — invoices or receipts change → invoices never carry IGTF; a receipt in foreign currency charges IGTF on top without reducing the outstanding balance. _ADR-006._
5. **Inventory** — stock movements or costing change → outbound larger than on-hand fails with `INSUFFICIENT_STOCK`; average cost excludes IVA; VES converts at the goods receipt's frozen rate. _ADR-007._
6. **Endpoints** — a new or changed route → the role matrix is enforced at the API and a test covers the 403. _PLAN → Roles._
7. **Errors** — a new failure path → returns a `Result`, not a throw; its message is in the UI message catalog. _ADR-009, ADR-012._
8. **Screens** — a new or changed screen → follows the issue's Design handoff; uses `packages/ui` tokens and components; copy uses the glossary's Spanish column; a Playwright E2E covers the acceptance criteria. _ADR-012, ADR-014._
9. **Migrations** — a migration is added → existing migrations are not edited; it applies cleanly on a seeded database.
10. **Quality gates** — the diff touches Biome, dependency-cruiser or tsconfig settings, CI workflows, `REVIEW.md`, `verify`, or removes or skips a test → flag it explicitly; the PR must justify it (deleted flaky tests state why). _ADR-014._
