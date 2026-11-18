import { z } from "zod";

const DEFAULT_DATABASE_URL = "postgres://cuadre:cuadre@localhost:5433/cuadre";

/** Development-only signing secret for sessions. Production must set its own (checked below). */
export const DEV_AUTH_SECRET = "cuadre-dev-only-secret-not-for-production";
/** The browser's origin in development: the web dev server, which proxies `/api` to the API. */
const DEFAULT_AUTH_URL = "http://localhost:5173";

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    BETTER_AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
    /** Origin the browser loads the app from; Better Auth's `baseURL` and first trusted origin. */
    BETTER_AUTH_URL: z.url().default(DEFAULT_AUTH_URL),
    /** Extra trusted origins, comma-separated. */
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && env.BETTER_AUTH_SECRET === DEV_AUTH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET must be set explicitly in production.",
      });
    }
  })
  .transform(({ BETTER_AUTH_TRUSTED_ORIGINS, ...env }) => {
    const extra = (BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== "");
    // `localhost` and `127.0.0.1` are different origins to the browser; in development either works.
    const devTwin = env.BETTER_AUTH_URL === DEFAULT_AUTH_URL ? ["http://127.0.0.1:5173"] : [];
    return { ...env, trustedOrigins: [env.BETTER_AUTH_URL, ...devTwin, ...extra] };
  });

export type Config = z.infer<typeof envSchema>;

/** Development defaults make a fresh clone work without a `.env`; the environment overrides them. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return envSchema.parse(env);
}
