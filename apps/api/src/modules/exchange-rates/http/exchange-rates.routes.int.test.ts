import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, type Sessions, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createExchangeRatesModule } from "../index.ts";

const { db, close } = createDb(testDatabaseUrl());
const FIXED_TODAY = "2026-11-17";
const testApp = createTestApp(db, { today: () => FIXED_TODAY });
const { app } = testApp;

let session: Record<string, string> = {};
const get = (path: string) => app.request(path, { headers: session });
const post = (body: unknown) =>
  app.request("/api/exchange-rates", {
    method: "POST",
    headers: { ...session, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const patch = (date: string, body: unknown) =>
  app.request(`/api/exchange-rates/${date}`, {
    method: "PATCH",
    headers: { ...session, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(async () => {
  await resetDatabase(db);
  session = await signIn(db, testApp);
});
afterAll(close);

describe("POST /api/exchange-rates", () => {
  it("records a rate and returns it formatted to 8 decimals", async () => {
    const res = await post({ date: "2026-11-17", rate: "36.5123" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      date: "2026-11-17",
      rate: "36.51230000",
      frozen: false,
    });
  });

  it("answers 409 RATE_ALREADY_EXISTS for duplicate date", async () => {
    await post({ date: "2026-11-17", rate: "36.5123" });
    const res = await post({ date: "2026-11-17", rate: "36.6" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "RATE_ALREADY_EXISTS", date: "2026-11-17" });
  });

  it("accepts +7 days ahead and answers 400 RATE_DATE_TOO_FAR for +8 days ahead", async () => {
    const plus7 = await post({ date: "2026-11-24", rate: "36.5" });
    expect(plus7.status).toBe(201);

    const plus8 = await post({ date: "2026-11-25", rate: "36.5" });
    expect(plus8.status).toBe(400);
    expect(await plus8.json()).toEqual({ code: "RATE_DATE_TOO_FAR", date: "2026-11-25" });
  });

  it("rejects 9 decimals, zero, negative, and >12 integer digits with VALIDATION_ERROR", async () => {
    for (const [rate, code] of [
      ["36.123456789", "TOO_MANY_DECIMALS"],
      ["0", "NOT_POSITIVE"],
      ["-36.5", "NOT_POSITIVE"],
      ["1000000000000", "OUT_OF_RANGE"],
    ] as const) {
      const res = await post({ date: "2026-11-17", rate });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        code: "VALIDATION_ERROR",
        issues: [{ field: "rate", code }],
      });
    }
  });

  it("rejects non-object and malformed JSON bodies with VALIDATION_ERROR", async () => {
    for (const body of ["null", "[]", "{not json"]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "VALIDATION_ERROR" });
    }
  });
});

describe("PATCH /api/exchange-rates/:date", () => {
  it("corrects an unfrozen rate", async () => {
    await post({ date: "2026-11-17", rate: "36.5123" });

    const res = await patch("2026-11-17", { rate: "36.52" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-11-17",
      rate: "36.52000000",
      frozen: false,
    });
  });

  it("answers 409 RATE_ALREADY_FROZEN after an issued document has frozen the rate", async () => {
    await post({ date: "2026-11-17", rate: "36.5123" });
    const mod = createExchangeRatesModule({ db, today: () => FIXED_TODAY });
    await db.transaction(async (tx) => {
      await mod.lookupAndFreezeForDate("2026-11-17", tx);
    });

    const res = await patch("2026-11-17", { rate: "36.52" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "RATE_ALREADY_FROZEN", date: "2026-11-17" });
  });

  it("answers 404 NOT_FOUND when the date has no rate and 400 VALIDATION_ERROR on invalid param/rate", async () => {
    const missing = await patch("2026-11-17", { rate: "36.5" });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: "NOT_FOUND", date: "2026-11-17" });

    const badDate = await patch("not-a-date", { rate: "36.5" });
    expect(badDate.status).toBe(400);
    expect(await badDate.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "date", code: "INVALID_DATE" }],
    });

    const badRate = await patch("2026-11-17", { rate: "0" });
    expect(badRate.status).toBe(400);
    expect(await badRate.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "rate", code: "NOT_POSITIVE" }],
    });
  });
});

describe("GET /api/exchange-rates and GET /api/exchange-rates/current", () => {
  it("lists rates newest-first and rejects invalid page queries", async () => {
    await post({ date: "2026-11-14", rate: "36.4" });
    await post({ date: "2026-11-17", rate: "36.5123" });

    const res = await get("/api/exchange-rates");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { date: "2026-11-17", rate: "36.51230000", frozen: false },
        { date: "2026-11-14", rate: "36.40000000", frozen: false },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });

    for (const query of ["page=0", "page=abc"]) {
      const bad = await get(`/api/exchange-rates?${query}`);
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    }
  });

  it("current ignores future rates and falls back to the latest rate <= today", async () => {
    expect(await (await get("/api/exchange-rates/current")).json()).toEqual({ rate: null });

    // Only a future rate (18/11 on 17/11) -> still null
    await post({ date: "2026-11-18", rate: "36.9" });
    expect(await (await get("/api/exchange-rates/current")).json()).toEqual({ rate: null });

    // Earlier rate (14/11) -> returns 14/11, ignoring 18/11
    await post({ date: "2026-11-14", rate: "36.4" });
    expect(await (await get("/api/exchange-rates/current")).json()).toEqual({
      rate: { date: "2026-11-14", rate: "36.40000000", frozen: false },
    });

    // Today's rate (17/11) -> returns 17/11, ignoring 18/11
    await post({ date: "2026-11-17", rate: "36.5123" });
    expect(await (await get("/api/exchange-rates/current")).json()).toEqual({
      rate: { date: "2026-11-17", rate: "36.51230000", frozen: false },
    });
  });
});

describe("roles (PLAN → Roles: admin writes, every role reads)", () => {
  let sessions: Sessions;
  beforeEach(async () => {
    sessions = await signInAll(db, testApp);
  });

  it("POST /api/exchange-rates allows only admin", () =>
    expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: "/api/exchange-rates", body: { date: "2026-11-17", rate: "36.5" } },
      ["admin"],
      201,
    ));

  it("PATCH /api/exchange-rates/:date allows only admin", async () => {
    await post({ date: "2026-11-17", rate: "36.5" });
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "PATCH", path: "/api/exchange-rates/2026-11-17", body: { rate: "36.6" } },
      ["admin"],
      200,
    );
  });

  it("GET /api/exchange-rates allows every role", () =>
    expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/exchange-rates" },
      ["admin", "sales", "purchasing", "warehouse"],
      200,
    ));

  it("GET /api/exchange-rates/current allows every role", () =>
    expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/exchange-rates/current" },
      ["admin", "sales", "purchasing", "warehouse"],
      200,
    ));

  it("refuses the role before validating: an invalid body from sales is 403, not 400", async () => {
    session = sessions.sales;
    const res = await post({ date: "bad", rate: "0" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
  });

  it("documents 403 and path parameters in /openapi.json", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<
        string,
        Record<
          string,
          { parameters?: { name: string; in: string }[]; responses: Record<string, unknown> }
        >
      >;
    };

    for (const method of ["get", "post"]) {
      expect(Object.keys(doc.paths["/api/exchange-rates"]?.[method]?.responses ?? {})).toContain(
        "403",
      );
    }
    expect(Object.keys(doc.paths["/api/exchange-rates/current"]?.get?.responses ?? {})).toContain(
      "403",
    );
    expect(Object.keys(doc.paths["/api/exchange-rates/{date}"]?.patch?.responses ?? {})).toContain(
      "403",
    );
    expect(doc.paths["/api/exchange-rates/{date}"]?.patch?.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "date", in: "path" })]),
    );
  });
});
