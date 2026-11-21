import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/reset-database.ts";
import { createTestApp, signIn } from "../../test/sign-in.ts";
import { testDatabaseUrl } from "../../test/test-database.ts";
import { createDb } from "../db/client.ts";
import { useErrorHandlers } from "../http/api-error.ts";
import { allowRoles, routesWithoutRoles } from "./roles.ts";

const { db, close } = createDb(testDatabaseUrl());

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("every API route declares its roles", () => {
  // The test that fails when a slice adds a route without `allowRoles` (issue #11).
  it("no endpoint of the app is left without a role declaration", () => {
    expect(routesWithoutRoles(createTestApp(db).app)).toEqual([]);
  });

  it("finds a declaration through the wrapper of a sub-app with its own error handler", () => {
    const routes = new OpenAPIHono();
    useErrorHandlers(routes);
    routes.get("/declared", allowRoles(["admin"]), (c) => c.json({}));
    const app = new Hono().route("/api", routes);

    expect(routesWithoutRoles(app)).toEqual([]);
  });
});

describe("deny by default", () => {
  it("lists and refuses routes registered without a declaration, even to an admin", async () => {
    const testApp = createTestApp(db);
    const { app } = testApp;
    // Registered before the first request: the router is built on the first match.
    app.get("/api/undeclared", (c) => c.json({ reached: true }));
    app.all("/api/undeclared-all", (c) => c.json({ reached: true }));
    app.use("/api/terminal-use", async (c) => c.json({ reached: true }));

    expect(routesWithoutRoles(app).sort()).toEqual([
      "ALL /api/terminal-use",
      "ALL /api/undeclared-all",
      "GET /api/undeclared",
    ]);

    const admin = await signIn(db, testApp, "admin");
    for (const [method, path] of [
      ["GET", "/api/undeclared"],
      ["POST", "/api/undeclared-all"],
      ["GET", "/api/terminal-use"],
    ] as const) {
      const res = await app.request(path, { method, headers: admin });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect(await res.json()).toEqual({ code: "FORBIDDEN" });
    }
  });

  it("does not count a policy registered after the handler that answers", async () => {
    const testApp = createTestApp(db);
    const { app } = testApp;
    app.get("/api/late-policy", (c) => c.json({ reached: true }));
    app.get("/api/late-policy", allowRoles(["admin"]));

    expect(routesWithoutRoles(app)).toEqual(["GET /api/late-policy"]);
    const res = await app.request("/api/late-policy", {
      headers: await signIn(db, testApp, "admin"),
    });
    expect(res.status).toBe(403);
  });

  it("refuses an undeclared catch-all registered outside /api for requests under /api", async () => {
    const testApp = createTestApp(db);
    const { app } = testApp;
    app.get("*", (c) => c.json({ reached: true }));

    const res = await app.request("/api/anything", {
      headers: await signIn(db, testApp, "admin"),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
  });

  it("leaves unknown paths, Better Auth, health and the OpenAPI document as they were", async () => {
    const testApp = createTestApp(db);
    const admin = await signIn(db, testApp, "admin");
    const { app } = testApp;

    const unknown = await app.request("/api/nope", { headers: admin });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ code: "NOT_FOUND" });
    expect((await app.request("/api/auth/get-session", { headers: admin })).status).toBe(200);
    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/openapi.json")).status).toBe(200);
  });
});

describe("allowRoles", () => {
  it("refuses with 403 when there is no signed-in user, instead of failing", async () => {
    const app = new Hono().get("/x", allowRoles(["admin"]), (c) => c.json({ reached: true }));

    const res = await app.request("/x");

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
  });

  it("refuses an empty list when the route is defined", () => {
    expect(() => allowRoles([])).toThrow("at least one role");
  });
});
