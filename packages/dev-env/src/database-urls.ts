// Default database URLs for local development, integration tests and E2E (no `.env` needed).
//
// Every worktree shares one Postgres container (docker-compose `name: cuadre`, port 5433) but gets
// its own databases, so migrations from different branches never mix: `cuadre_<worktree>`,
// `cuadre_<worktree>_test`, `cuadre_<worktree>_e2e`. The main checkout keeps `cuadre`, `cuadre_test`
// and `cuadre_e2e`. Explicit `DATABASE_URL*` variables always win; callers check them first.
//
// Runs on Node's type stripping too (`scripts/verify.mts`): relative `.ts` imports, no enums.
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type DatabaseKind = "dev" | "test" | "e2e";

/** Postgres identifiers are at most 63 bytes; `cuadre_` + name + `_test` must fit. */
const MAX_WORKTREE_LENGTH = 40;

/**
 * The linked worktree this code lives in, as a database-name fragment (`[a-z0-9_]`), or undefined
 * in the main checkout and outside git (a deployed build). A linked worktree has a `.git` file;
 * the main checkout has a `.git` directory.
 */
export function worktreeName(from: string = fileURLToPath(import.meta.url)): string | undefined {
  for (let dir = dirname(from); ; dir = dirname(dir)) {
    const git = join(dir, ".git");
    if (existsSync(git)) {
      if (statSync(git).isDirectory()) return undefined;
      const name = basename(dir)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, MAX_WORKTREE_LENGTH)
        .replace(/_+$/, "");
      return name === "" ? undefined : name;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** `cuadre`, `cuadre_test`, `cuadre_e2e`; with a worktree, its name goes after `cuadre_`. */
export function databaseName(kind: DatabaseKind, worktree?: string | null): string {
  const base = worktree == null ? "cuadre" : `cuadre_${worktree}`;
  return kind === "dev" ? base : `${base}_${kind}`;
}

/**
 * The default URL of a database on the local Postgres of `docker-compose.yml`, for the checkout
 * this code lives in (`worktree`: a worktree name, or `null` for the main checkout).
 */
export function defaultDatabaseUrl(
  kind: DatabaseKind,
  worktree: string | null = worktreeName() ?? null,
): string {
  // The E2E tooling (Playwright's servers, verify's port probe) has always used 127.0.0.1.
  const host = kind === "e2e" ? "127.0.0.1" : "localhost";
  return `postgres://cuadre:cuadre@${host}:5433/${databaseName(kind, worktree)}`;
}
