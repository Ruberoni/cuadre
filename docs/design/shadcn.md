# Adding shadcn/ui Components in `apps/web`

Components come from the pinned shadcn CLI (`ADR-015`). Run from **`apps/web`** (it resolves paths from the cwd):

```bash
pnpm dlx shadcn@4.23.0 add <name>
```

It writes `src/components/ui/<name>.tsx` with `@/…` imports.

## Post-add fixup checklist

1. Run `git status` at the repo root and `pnpm install`.
2. Rewrite `from "cn"` to `from "@/lib/utils"`.
3. Drop any dependency it adds that the component does not import (it adds `cn`) and any `minimumReleaseAgeExclude` it writes to `pnpm-workspace.yaml`.
4. Keep `lucide-react` pinned to its existing version (do not bump to the registry's latest).
5. Replace literal colors, Tailwind's default shadows, and `rounded-xs` with semantic token classes (`bg-overlay`, `text-destructive-foreground`, `hover:bg-primary-hover`, `shadow-popover`, `shadow-dialog`, `rounded-sm`).
6. Format with `pnpm exec biome check --write apps/web`.
7. Aligning a component to Cuadre's compact density and focus ring happens in the slice that first shows it on a screen.
