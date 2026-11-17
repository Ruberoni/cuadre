/** The integration-test database: separate from the dev one so `pnpm dev` data is never touched. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL_TEST ?? "postgres://cuadre:cuadre@localhost:5433/cuadre_test";
}
