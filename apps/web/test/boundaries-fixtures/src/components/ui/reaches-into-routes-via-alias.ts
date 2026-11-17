// Violation through the `@/` alias: it must resolve to apps/web/src/routes, or the rule is blind.
import { Route } from "@/routes/__root.tsx";

export const reachesIntoRoutesViaAlias = Route;
