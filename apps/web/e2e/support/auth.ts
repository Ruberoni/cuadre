import type { APIRequestContext, Page } from "@playwright/test";

/**
 * The seeded users' test credentials (apps/api/src/auth/seed-users.ts, also in AGENTS.md): test
 * values only, never real passwords. The API's E2E server seeds them (`db:seed:users`).
 */
export const SEED_PASSWORD = "cuadre-demo-2026";
export const ADMIN = { name: "María Fernández", email: "admin@cuadre.test" };

/** The browser's origin, which the API trusts (Playwright config: `BETTER_AUTH_URL`). */
const WEB_ORIGIN = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 4173}`;

/**
 * Signs a request context in through Better Auth; its cookie then goes with every later request of
 * that context. `baseUrl` empty = the web origin (the config's `baseURL`, proxied to the API).
 */
export async function signInRequest(
  request: APIRequestContext,
  baseUrl = "",
  user: { email: string } = ADMIN,
): Promise<void> {
  // Better Auth checks the origin of any request that already carries a cookie (CSRF).
  const response = await request.post(`${baseUrl}/api/auth/sign-in/email`, {
    headers: { origin: WEB_ORIGIN },
    data: { email: user.email, password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Could not sign in ${user.email}: ${response.status()}`);
}

/** "Given a signed-in admin": the page's browser context gets the session cookie. */
export function signIn(page: Page, user: { email: string } = ADMIN): Promise<void> {
  return signInRequest(page.request, "", user);
}
