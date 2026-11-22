import { ROLES, type Role } from "@cuadre/contracts";
import { expect } from "vitest";
import { SEED_PASSWORD, SEED_USERS, seedUsers } from "../src/auth/index.ts";
import type { Db } from "../src/db/client.ts";
import { cookiesOf, type createTestApp, signInRequest, TEST_ORIGIN } from "./sign-in.ts";

type TestApp = ReturnType<typeof createTestApp>;
export type Sessions = Record<Role, Record<string, string>>;

/** Seeds the four users in one go (hashing is slow) and signs each in: headers per role. */
export async function signInAll(db: Db, testApp: TestApp): Promise<Sessions> {
  await seedUsers(db, testApp.auth);
  const sessions: Partial<Sessions> = {};
  for (const role of ROLES) {
    const response = await signInRequest(testApp, SEED_USERS[role].email, SEED_PASSWORD);
    if (response.status !== 200) throw new Error(`Sign-in of ${role} failed: ${response.status}`);
    sessions[role] = { cookie: cookiesOf(response), origin: TEST_ORIGIN };
  }
  return sessions as Sessions;
}

type Call = { method: "GET" | "POST" | "PATCH"; path: string; body?: unknown };

/**
 * "This route allows exactly these roles", one line per route (PLAN → Roles, REVIEW item 6): each
 * allowed role gets `allowedStatus`, every other role 403 `FORBIDDEN`. Each role makes the same call,
 * so the allowed status must not depend on what an earlier call did (a POST lists its creator last).
 */
export async function expectAllowedRoles(
  { app }: TestApp,
  sessions: Sessions,
  call: Call,
  allowed: readonly Role[],
  allowedStatus: number,
): Promise<void> {
  const denied = ROLES.filter((role) => !allowed.includes(role));
  // Denied roles first: an allowed POST could otherwise turn their answer into a 409.
  for (const role of [...denied, ...allowed]) {
    const response = await app.request(call.path, {
      method: call.method,
      headers: {
        ...sessions[role],
        ...(call.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
    });
    const label = `${call.method} ${call.path} as ${role}`;
    if (allowed.includes(role)) {
      expect(response.status, label).toBe(allowedStatus);
    } else {
      expect(response.status, label).toBe(403);
      expect(await response.json(), label).toEqual({ code: "FORBIDDEN" });
    }
  }
}
