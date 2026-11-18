import type { Config } from "../config.ts";
import type { Db } from "../db/client.ts";
import { type Auth, createAuth } from "./auth.ts";

export { type Auth, createAuth } from "./auth.ts";
export { requireSession, type SessionVariables } from "./require-session.ts";
export { SEED_PASSWORD, SEED_USERS, seedUsers } from "./seed-users.ts";

export function createAuthFromConfig(db: Db, config: Config): Auth {
  return createAuth({
    db,
    secret: config.BETTER_AUTH_SECRET,
    baseUrl: config.BETTER_AUTH_URL,
    trustedOrigins: config.trustedOrigins,
  });
}
