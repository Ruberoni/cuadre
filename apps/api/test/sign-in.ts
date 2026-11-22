import type { Role } from "@cuadre/contracts";
import { createApp } from "../src/app.ts";
import { createAuthFromConfig, SEED_PASSWORD, SEED_USERS, seedUsers } from "../src/auth/index.ts";
import { loadConfig } from "../src/config.ts";
import type { Db } from "../src/db/client.ts";

/** The development defaults, whatever the environment says: tests do not depend on a `.env`. */
const config = loadConfig({});

/** A trusted origin: Better Auth rejects cookie-bearing POSTs without one (CSRF check). */
export const TEST_ORIGIN = config.BETTER_AUTH_URL;

export function createTestApp(db: Db, options?: { today?: () => string }) {
  const auth = createAuthFromConfig(db, config);
  return {
    app: createApp({ db, auth, ...(options?.today === undefined ? {} : { today: options.today }) }),
    auth,
  };
}

type TestApp = ReturnType<typeof createTestApp>;

/** The `cookie` header value of a response's `Set-Cookie`s (name=value pairs only). */
export function cookiesOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export function signInRequest({ app }: TestApp, email: string, password: string) {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: TEST_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Seeds the user of `role` (only that one: hashing is slow) and signs in. Returns the headers a
 * signed-in browser would send: the session cookie and its origin.
 */
export async function signIn(
  db: Db,
  testApp: TestApp,
  role: Role = "admin",
): Promise<Record<string, string>> {
  await seedUsers(db, testApp.auth, [role]);
  const response = await signInRequest(testApp, SEED_USERS[role].email, SEED_PASSWORD);
  if (response.status !== 200) throw new Error(`Sign-in failed with ${response.status}`);
  return { cookie: cookiesOf(response), origin: TEST_ORIGIN };
}
