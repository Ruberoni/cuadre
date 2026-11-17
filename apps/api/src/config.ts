import { z } from "zod";

const DEFAULT_DATABASE_URL = "postgres://cuadre:cuadre@localhost:5433/cuadre";
const DEFAULT_DATABASE_URL_TEST = "postgres://cuadre:cuadre@localhost:5433/cuadre_test";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
  DATABASE_URL_TEST: z.string().min(1).default(DEFAULT_DATABASE_URL_TEST),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Config = z.infer<typeof envSchema>;

/** Development defaults make a fresh clone work without a `.env`; the environment overrides them. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return envSchema.parse(env);
}
