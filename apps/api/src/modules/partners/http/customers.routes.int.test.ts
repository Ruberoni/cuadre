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
  app.request("/api/customers", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const esquina = {
  rif: "J-40987654-3",
  name: "Abastos La Esquina, C.A.",
  phone: "+58 212-555-0201",
  email: "compras@laesquina.test",
  address: "Av. Francisco de Miranda, Chacao, Caracas",
};

beforeEach(async () => {
  await resetDatabase(db);
  session = await signIn(db, testApp, "sales");
});
afterAll(close);

describe("POST /api/customers", () => {
  it("creates a customer as sales and answers 201", async () => {
    const res = await post(esquina);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: "compras@laesquina.test",
      address: "Av. Francisco de Miranda, Chacao, Caracas",
    });
  });

  it("creates an individual customer with RIF V-12345678-1 and answers 201", async () => {
    const res = await post({ rif: "V-12345678-1", name: "María Elena González" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      rif: "V-12345678-1",
      name: "María Elena González",
      phone: null,
      email: null,
      address: null,
    });
  });

  it("creates a customer as admin and normalises j409876543 to J-40987654-3", async () => {
    const admin = await signIn(db, testApp, "admin");
    const res = await post({ rif: "j409876543", name: "Abastos La Esquina, C.A." }, admin);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: null,
      email: null,
      address: null,
    });
  });

  it("answers 400 VALIDATION_ERROR with INVALID_CHECK_DIGIT for bad check digit", async () => {
    const res = await post({ rif: "J-40987654-9", name: "Abastos La Esquina, C.A." });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "rif", code: "INVALID_CHECK_DIGIT" }],
    });
  });

  it("answers 409 RIF_ALREADY_EXISTS when the RIF already exists as a customer", async () => {
    await post(esquina);

    const res = await post({ rif: "j409876543", name: "Otro Cliente, C.A." });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      code: "RIF_ALREADY_EXISTS",
      rif: "J-40987654-3",
    });

    const resConfirm = await post({
      rif: "j409876543",
      name: "Otro Cliente, C.A.",
      confirmExistingPartner: true,
    });
    expect(resConfirm.status).toBe(409);
    expect(await resConfirm.json()).toEqual({
      code: "RIF_ALREADY_EXISTS",
      rif: "J-40987654-3",
    });
  });

  it("warns with 409 PARTNER_ALREADY_EXISTS for an existing supplier and promotes on confirm (200) keeping legal name", async () => {
    const purchasing = await signIn(db, testApp, "purchasing");
    const createdSupplier = await app.request("/api/suppliers", {
      method: "POST",
      headers: { ...purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        rif: "J-30123456-1",
        name: "Distribuidora Andina, C.A.",
        phone: "+58 212-555-0101",
        email: "ventas@andina.test",
        address: "Zona Industrial La Yaguara, Caracas",
      }),
    });
    expect(createdSupplier.status).toBe(201);
    const supplierDto = (await createdSupplier.json()) as { id: string };

    // First attempt using unnormalised RIF triggers warning without mutating DB.
    const warned = await post({
      rif: "j301234561",
      name: "Otro Nombre, C.A.",
    });
    expect(warned.status).toBe(409);
    expect(await warned.json()).toEqual({
      code: "PARTNER_ALREADY_EXISTS",
      rif: "J-30123456-1",
      partnerName: "Distribuidora Andina, C.A.",
    });

    const beforeConfirm = await get("/api/customers");
    expect((await beforeConfirm.json()) as { total: number }).toMatchObject({ total: 0 });

    // Confirming with unnormalised RIF promotes the existing partner keeping its id, name, and contact fields.
    const promoted = await post({
      rif: "j301234561",
      name: "Otro Nombre, C.A.",
      phone: "+58 414-000-0000",
      confirmExistingPartner: true,
    });
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toEqual({
      id: supplierDto.id,
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
      address: "Zona Industrial La Yaguara, Caracas",
    });

    const afterConfirm = await get("/api/customers");
    const body = (await afterConfirm.json()) as { items: { id: string; name: string }[] };
    expect(body.items).toEqual([
      expect.objectContaining({ id: supplierDto.id, name: "Distribuidora Andina, C.A." }),
    ]);
  });
});

describe("GET /api/customers", () => {
  it("lists and searches customers by name and RIF", async () => {
    await post(esquina);
    await post({ rif: "V-12345678-1", name: "María Elena González" });

    const byName = await get("/api/customers?q=esquina");
    expect(byName.status).toBe(200);
    const byNameBody = (await byName.json()) as { items: { rif: string }[]; total: number };
    expect(byNameBody.total).toBe(1);
    expect(byNameBody.items.map((item) => item.rif)).toEqual(["J-40987654-3"]);

    const byRif = await get("/api/customers?q=V-123");
    expect(byRif.status).toBe(200);
    const byRifBody = (await byRif.json()) as { items: { rif: string }[]; total: number };
    expect(byRifBody.items.map((item) => item.rif)).toEqual(["V-12345678-1"]);
  });
});

describe("roles & OpenAPI", () => {
  let sessions: Sessions;

  beforeEach(async () => {
    sessions = await signInAll(db, testApp);
  });

  it("allows only admin and sales on GET /api/customers (purchasing and warehouse get 403)", async () => {
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/customers" },
      ["admin", "sales"],
      200,
    );
  });

  it("allows only admin and sales on POST /api/customers (purchasing and warehouse get 403)", async () => {
    // Use an invalid body (400) so both allowed roles pass the role gate without colliding on 409.
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: "/api/customers", body: { rif: "J-123", name: "Test" } },
      ["admin", "sales"],
      400,
    );
  });

  it("documents 403 on both customer operations in /openapi.json", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };

    for (const method of ["get", "post"]) {
      expect(Object.keys(doc.paths["/api/customers"]?.[method]?.responses ?? {})).toContain("403");
    }
  });
});
