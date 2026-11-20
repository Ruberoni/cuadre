import { ROLES } from "@cuadre/contracts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "../db/client.ts";
import { authTables } from "./auth.table.ts";

export type AuthOptions = {
  db: Db;
  secret: string;
  /** The browser's origin (the web app, which proxies `/api`). */
  baseUrl: string;
  trustedOrigins: readonly string[];
};

/**
 * Better Auth, email + password only (ADR-003). Sign-up is closed: users come from the seed, one per
 * role. Sessions and the rate limit keep Better Auth's defaults (7 days renewed daily; the limit is
 * on in production only), as the Login handoff (#10) records.
 */
export function createAuth({ db, secret, baseUrl, trustedOrigins }: AuthOptions) {
  return betterAuth({
    appName: "Cuadre",
    secret,
    baseURL: baseUrl,
    basePath: "/api/auth",
    trustedOrigins: [...trustedOrigins],
    database: drizzleAdapter(db, { provider: "pg", schema: authTables }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
      additionalFields: {
        // `input: false`: no endpoint accepts it from the client (update-user, sign-up).
        role: { type: [...ROLES], required: true, input: false },
      },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
