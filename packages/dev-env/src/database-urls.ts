// Default database URLs for local development, integration tests and E2E (no `.env` needed).
//
// Every worktree shares one Postgres container (docker-compose `name: cuadre`, port 5433) but gets
// its own databases, so migrations from different branches never mix: `cuadre_wt_<worktree>__dev`,
// `__test` and `__e2e`, where `<worktree>` is the directory name folded to `[a-z0-9_]` plus a
// short hash of its path (two `pr-57` directories in different places do not collide). Folding
// never produces `__`, so no worktree name can reach another kind's database, and only e2e names
// end in `_e2e` (the DROP guard of `db:e2e:prepare`). The main checkout keeps `cuadre`,
// `cuadre_test` and `cuadre_e2e`. Explicit `DATABASE_URL*` variables always win; callers check
// them first.
//
// Runs on Node's type stripping too (`scripts/verify.mts`): relative `.ts` imports, no enums.
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type DatabaseKind = "dev" | "test" | "e2e";

/** Postgres identifiers are at most 63 bytes: `cuadre_wt_` + name + `_` + hash + `__test`. */
const MAX_NAME_LENGTH = 38;
const HASH_LENGTH = 6;

/**
 * The linked worktree this code lives in, as a database-name fragment (`[a-z0-9_]`, no `__`: its
 * folded directory name and a hash of its path), or undefined
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
        .slice(0, MAX_NAME_LENGTH)
        .replace(/_+$/, "");
      const path = process.platform === "win32" ? dir.toLowerCase().replaceAll("\\", "/") : dir;
      const hash = createHash("sha256").update(path).digest("hex").slice(0, HASH_LENGTH);
      return name === "" ? hash : `${name}_${hash}`;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** `cuadre`, `cuadre_test`, `cuadre_e2e`; with a worktree, `cuadre_wt_<worktree>__<kind>`. */
export function databaseName(kind: DatabaseKind, worktree?: string | null): string {
  if (worktree != null) return `cuadre_wt_${worktree}__${kind}`;
  return kind === "dev" ? "cuadre" : `cuadre_${kind}`;
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
  // Same variable and default as docker-compose.yml.
  const port = process.env.POSTGRES_PORT ?? "5433";
  return `postgres://cuadre:cuadre@${host}:${port}/${databaseName(kind, worktree)}`;
}
