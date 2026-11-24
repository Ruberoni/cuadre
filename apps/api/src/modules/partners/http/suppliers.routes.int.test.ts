import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, type Sessions, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";

const { db, close } = createDb(testDatabaseUrl());
const testApp = createTestApp(db);
const { app } = testApp;
let session: Record<string, string> = {};

const get = (path: string, headers: Record<string, string> = session) =>
  app.request(path, { headers });

const post = (body: unknown, headers: Record<string, string> = session) =>
  app.request("/api/suppliers", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const andina = {
  rif: "J-30123456-1",
  name: "Distribuidora Andina, C.A.",
  phone: "+58 212-555-0101",
  email: "ventas@andina.test",
  address: "Zona Industrial La Yaguara, Caracas",
};

beforeEach(async () => {
  await resetDatabase(db);
  session = await signIn(db, testApp, "purchasing");
});
afterAll(close);

describe("POST /api/suppliers", () => {
  it("creates a supplier as purchasing and answers 201", async () => {
    const res = await post(andina);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
      address: "Zona Industrial La Yaguara, Caracas",
    });
  });

  it("creates a supplier as admin and normalises j301234561 to J-30123456-1", async () => {
    const admin = await signIn(db, testApp, "admin");
    const res = await post({ rif: "j301234561", name: "Distribuidora Andina, C.A." }, admin);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: null,
      email: null,
      address: null,
    });
  });

  it("answers 400 VALIDATION_ERROR with INVALID_CHECK_DIGIT for J-30123456-7", async () => {
    const res = await post({ rif: "J-30123456-7", name: "Distribuidora Andina, C.A." });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "rif", code: "INVALID_CHECK_DIGIT" }],
    });
  });

  it("answers 400 VALIDATION_ERROR with INVALID_FORMAT for J-123", async () => {
    const res = await post({ rif: "J-123", name: "Distribuidora Andina, C.A." });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "rif", code: "INVALID_FORMAT" }],
    });
  });

  it("answers 409 RIF_ALREADY_EXISTS with the normalised RIF when already taken", async () => {
    await post(andina);

    const res = await post({ rif: "j301234561", name: "Otra Empresa, C.A." });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: "RIF_ALREADY_EXISTS",
      rif: "J-30123456-1",
    });
  });

  it("warns with 409 PARTNER_ALREADY_EXISTS for an existing customer and promotes on confirm (200) keeping legal name", async () => {
    const sales = await signIn(db, testApp, "sales");
    const createdCustomer = await app.request("/api/customers", {
      method: "POST",
      headers: { ...sales, "content-type": "application/json" },
      body: JSON.stringify({
        rif: "J-40987654-3",
        name: "Abastos La Esquina, C.A.",
        phone: "+58 212-555-0201",
      }),
    });
    expect(createdCustomer.status).toBe(201);
    const customerDto = (await createdCustomer.json()) as { id: string };

    const warned = await post({ rif: "J-40987654-3", name: "Otro Nombre, C.A." });
    expect(warned.status).toBe(409);
    expect(await warned.json()).toEqual({
      code: "PARTNER_ALREADY_EXISTS",
      rif: "J-40987654-3",
      partnerName: "Abastos La Esquina, C.A.",
    });

    const promoted = await post({
      rif: "J-40987654-3",
      name: "Otro Nombre, C.A.",
      confirmExistingPartner: true,
    });
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toEqual({
      id: customerDto.id,
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: null,
      address: null,
    });
  });
});

describe("GET /api/suppliers", () => {
  it("lists and searches suppliers by name and RIF", async () => {
    await post(andina);
    await post({ rif: "J-40234567-4", name: "Alimentos del Sur, C.A." });

    const byName = await get("/api/suppliers?q=andina");
    expect(byName.status).toBe(200);
    const byNameBody = (await byName.json()) as { items: { rif: string }[]; total: number };
    expect(byNameBody.total).toBe(1);
    expect(byNameBody.items.map((item) => item.rif)).toEqual(["J-30123456-1"]);

    const byRif = await get("/api/suppliers?q=J-301");
    expect(byRif.status).toBe(200);
    const byRifBody = (await byRif.json()) as { items: { rif: string }[]; total: number };
    expect(byRifBody.items.map((item) => item.rif)).toEqual(["J-30123456-1"]);
  });
});

describe("roles & OpenAPI", () => {
  let sessions: Sessions;

  beforeEach(async () => {
    sessions = await signInAll(db, testApp);
  });

  it("allows only admin and purchasing on GET /api/suppliers (sales and warehouse get 403)", async () => {
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/suppliers" },
      ["admin", "purchasing"],
      200,
    );
  });

  it("allows only admin and purchasing on POST /api/suppliers (sales and warehouse get 403)", async () => {
    // Use an invalid body (400) so both allowed roles pass the role gate without colliding on 409.
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: "/api/suppliers", body: { rif: "J-123", name: "Test" } },
      ["admin", "purchasing"],
      400,
    );
  });

  it("documents 403 on both supplier operations in /openapi.json", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };

    for (const method of ["get", "post"]) {
      expect(Object.keys(doc.paths["/api/suppliers"]?.[method]?.responses ?? {})).toContain("403");
    }
  });
});
