import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/reset-database.ts";
import {
  cookiesOf,
  createTestApp,
  signIn,
  signInRequest,
  TEST_ORIGIN,
} from "../../test/sign-in.ts";
import { testDatabaseUrl } from "../../test/test-database.ts";
import { createDb } from "../db/client.ts";
import { sessionsTable, usersTable } from "./auth.table.ts";
import { SEED_PASSWORD, SEED_USERS, seedUsers } from "./seed-users.ts";

const { db, close } = createDb(testDatabaseUrl());
const testApp = createTestApp(db);
const { app, auth } = testApp;
const admin = SEED_USERS.admin;

const json = (headers: Record<string, string> = {}) => ({
  ...headers,
  "content-type": "application/json",
  origin: TEST_ORIGIN,
});

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("the seed", () => {
  it("creates one user per role and is safe to run again", async () => {
    expect(await seedUsers(db, auth)).toBe(4);
    expect(await seedUsers(db, auth)).toBe(0);

    const users = await db
      .select({ email: usersTable.email, role: usersTable.role })
      .from(usersTable);
    expect(users).toHaveLength(4);
    expect(new Set(users.map((user) => user.role))).toEqual(
      new Set(["admin", "sales", "purchasing", "warehouse"]),
    );
  });

  it("repairs a user left without its password account", async () => {
    await db
      .insert(usersTable)
      .values({ id: "half-created", name: admin.name, email: admin.email, role: "admin" });

    expect(await seedUsers(db, auth, ["admin"])).toBe(1);
    expect((await signInRequest(testApp, admin.email, SEED_PASSWORD)).status).toBe(200);
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("signs the seeded admin in: session cookie and the user with role admin", async () => {
    await seedUsers(db, auth, ["admin"]);

    const res = await signInRequest(testApp, admin.email, SEED_PASSWORD);

    expect(res.status).toBe(200);
    expect(cookiesOf(res)).toMatch(/session_token=/);
    expect(await res.json()).toMatchObject({
      user: { email: admin.email, name: admin.name, role: "admin" },
    });
  });

  it("answers a wrong password and an unknown email exactly the same way", async () => {
    await seedUsers(db, auth, ["admin"]);

    const wrongPassword = await signInRequest(testApp, admin.email, "not-the-password");
    const unknownEmail = await signInRequest(testApp, "nadie@cuadre.test", SEED_PASSWORD);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const body = await wrongPassword.json();
    expect(body).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD" });
    expect(await unknownEmail.json()).toEqual(body);
    expect(cookiesOf(wrongPassword)).toBe("");
  });
});

describe("closed doors", () => {
  it("rejects sign-up and creates no user", async () => {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: json(),
      body: JSON.stringify({
        name: "Intruso",
        email: "intruso@cuadre.test",
        password: "x".repeat(12),
      }),
    });

    expect(res.status).toBe(400);
    expect(await db.select().from(usersTable)).toEqual([]);
  });

  it("never lets a user change their own role", async () => {
    const session = await signIn(db, testApp, "sales");
    const updateUser = (body: unknown) =>
      app.request("/api/auth/update-user", {
        method: "POST",
        headers: json(session),
        body: JSON.stringify(body),
      });
    const stored = async () =>
      (
        await db
          .select({ name: usersTable.name, role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.email, SEED_USERS.sales.email))
      )[0];

    // The request itself works (session, origin, body)…
    expect((await updateUser({ name: "Otro nombre" })).status).toBe(200);
    expect(await stored()).toEqual({ name: "Otro nombre", role: "sales" });

    // …but one that carries a role is refused, and the role stays.
    const res = await updateUser({ name: "Intruso", role: "admin" });
    expect(res.status).toBe(400);
    expect(await stored()).toEqual({ name: "Otro nombre", role: "sales" });
  });
});

describe("the session gate", () => {
  const products = (headers: Record<string, string> = {}) =>
    app.request("/api/products", { headers });

  it.each([
    ["GET", "/api/products"],
    ["POST", "/api/products"],
    ["GET", "/api/unknown"],
  ])("answers %s %s without a session with 401 UNAUTHORIZED", async (method, path) => {
    const res = await app.request(path, {
      method,
      headers: json(),
      ...(method === "POST" ? { body: "{}" } : {}),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "UNAUTHORIZED" });
  });

  it("answers a forged session cookie with 401", async () => {
    const res = await products({ cookie: "better-auth.session_token=forged.value" });
    expect(res.status).toBe(401);
  });

  it("answers an expired session with 401", async () => {
    const session = await signIn(db, testApp);
    await db.update(sessionsTable).set({ expiresAt: sql`now() - interval '1 minute'` });

    expect((await products(session)).status).toBe(401);
  });

  it("lets a signed-in user through, and keeps health and the OpenAPI document public", async () => {
    const session = await signIn(db, testApp);

    expect((await products(session)).status).toBe(200);
    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/openapi.json")).status).toBe(200);
  });

  it("answers get-session without a session with null, not 401", async () => {
    const res = await app.request("/api/auth/get-session");
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe("POST /api/auth/sign-out", () => {
  it("ends the session: the same cookie then gets 401", async () => {
    const session = await signIn(db, testApp);

    const res = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: json(session),
      body: "{}",
    });

    expect(res.status).toBe(200);
    expect((await app.request("/api/products", { headers: session })).status).toBe(401);
  });
});
