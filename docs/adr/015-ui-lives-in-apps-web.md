# ADR-015: UI tokens and components live in apps/web

**Status:** Accepted

## Context
ADR-002 created `packages/ui` for design tokens and shadcn components, expecting more than one consumer. The MVP has one: `apps/web`. The package cost more than it gave:

- **The shadcn CLI wrote outside the repo.** Run from `packages/ui` with package aliases (`@cuadre/ui/*`), `shadcn add tooltip` (4.23.0) wrote `tooltip.tsx` into the root of the main checkout (the #41 sync had already hit the same kind of misplacement, plus self-imports between components that had to be rewritten by hand). With `apps/web` and an `@/*` alias, `shadcn add button` wrote only inside `apps/web` (checked on 2026-11-17 in a throwaway worktree).
- Tailwind needed `@source ".."` to scan a package linked through `node_modules`.
- Keeping the token scanner effective under Turborepo's cache took a duplicated test and an extra `turbo.json` input.
- The separate cache saved about 0.3 s of tests (ui 285 ms, web 366 ms), and token sync already works by path.

Not caused by the package: shadcn 4.23.0 emits `import { cn } from "cn"` and adds a `cn` dependency in both layouts, because the registry source itself uses `cn`. That fix-up stays.

## Decision
- Design tokens (snapshot, generator, generated CSS), shadcn components, `cn`, `Result` and the `es-VE` formatting helper live in `apps/web`, in shadcn's default single-app layout: `src/components/ui`, `src/lib`, `src/lib/format`, `src/styles`, `design-system/`, `scripts/`, with the `@/*` alias. CLI output is kept as written, except `from "cn"` (use `@/lib/utils`) and the color, shadow and radius classes that become tokens.
- A dependency-cruiser rule (`ui-primitives-stay-generic`) keeps primitives generic: `src/components/ui`, `src/lib`, `src/hooks` and `src/styles` never import screens.
- ADR-012 is unchanged in substance: the Design System still owns the tokens and the sync still runs through `sync-design-system`; only its target moves to `apps/web`.

## Considered and rejected
- **Keep `packages/ui`** (shadcn's monorepo layout, with a `components.json` per app): it pays off with several apps; with one it is only overhead.
- **A tokens package plus components in the app:** avoids the CLI problem but keeps a package for a snapshot and a generator.

## Consequences
- `shadcn add` runs from `apps/web` and stays inside the repo; only `cn` and token classes need fixing afterwards.
- `apps/web` unit tests also run the generator, formatting and scanner tests on every web change.
- Extract a package again when a second real consumer appears. Likeliest triggers: the API needing `Result` (ADR-009) or the formatting helper, or a second app. Storybook alone is not one; it runs inside `apps/web`.
- Extracting later is a mechanical move, but every screen importing `@/components/ui` must be rewritten then.
- Amends ADR-002 (package list) and ADR-012 (sync target).
