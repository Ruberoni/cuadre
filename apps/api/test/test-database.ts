import { defaultDatabaseUrl } from "@cuadre/dev-env";

/**
 * The integration-test database: separate from the dev one so `pnpm dev` data is never touched.
 * `cuadre_test` in the main checkout, `cuadre_<worktree>_test` in a worktree.
 */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL_TEST ?? defaultDatabaseUrl("test");
}
