import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, type Sessions, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";

const { db, close } = createDb(testDatabaseUrl());
const testApp = createTestApp(db);
const { app } = testApp;
/** A signed-in admin's cookie and origin, renewed after each reset. */
let session: Record<string, string> = {};
const get = (path: string) => app.request(path, { headers: session });

const flour = {
  sku: "HAR-PAN-1K",
  name: "Harina de maíz precocida 1 kg",
  unitOfMeasure: "BULK",
  salePrice: { minorUnits: 145, currency: "USD" },
  taxRate: "EXEMPT",
};

const post = (body: unknown) =>
  app.request("/api/products", {
    method: "POST",
    headers: { ...session, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

type Page = { items: { sku: string }[]; total: number; page: number; pageSize: number };
const getPage = async (query = ""): Promise<Page> =>
  (await (await get(`/api/products${query}`)).json()) as Page;
const skusOf = (page: Page) => page.items.map((item) => item.sku);

beforeEach(async () => {
  await resetDatabase(db);
  session = await signIn(db, testApp);
});
afterAll(close);

describe("POST /api/products", () => {
  it("creates the product and answers 201 with money as integer minor units", async () => {
    const res = await post(flour);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      sku: "HAR-PAN-1K",
      name: "Harina de maíz precocida 1 kg",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
  });

  it("answers 409 SKU_ALREADY_EXISTS with the stored code when it is taken", async () => {
    await post(flour);

    const res = await post({ ...flour, sku: "har-pan-1k" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "SKU_ALREADY_EXISTS", sku: "HAR-PAN-1K" });
  });

  it("rejects a domain rule violation with VALIDATION_ERROR and the field issues", async () => {
    const res = await post({
      ...flour,
      sku: "HAR PAN",
      name: "",
      salePrice: { minorUnits: 0, currency: "USD" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [
        { field: "sku", code: "INVALID_FORMAT" },
        { field: "name", code: "REQUIRED" },
        { field: "salePrice", code: "NOT_POSITIVE" },
      ],
    });
  });

  it("rejects a wire-shape violation with the same VALIDATION_ERROR body", async () => {
    const { taxRate: _omitted, ...withoutTaxRate } = flour;

    const res = await post({
      ...withoutTaxRate,
      unitOfMeasure: "PALLET",
      salePrice: { minorUnits: 1.5, currency: "USD" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: expect.arrayContaining([
        { field: "unitOfMeasure", code: "INVALID" },
        { field: "salePrice", code: "INVALID" },
        { field: "taxRate", code: "REQUIRED" },
      ]),
    });
  });

  it("names each invalid field once, even when several shape rules fail on it", async () => {
    const res = await post({ ...flour, salePrice: { minorUnits: 1.5, currency: "VES" } });

    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "salePrice", code: "INVALID" }],
    });
  });

  it.each(["null", "[]", '"text"'])(
    "answers a body that is not an object (%s) with VALIDATION_ERROR and no issues",
    async (body) => {
      const res = await post(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "VALIDATION_ERROR" });
    },
  );

  it("rejects a price in VES: products are priced in USD", async () => {
    const res = await post({ ...flour, salePrice: { minorUnits: 145, currency: "VES" } });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "salePrice", code: "INVALID" }],
    });
  });

  it("rejects a malformed JSON body with VALIDATION_ERROR, not a text 500", async () => {
    const res = await post("{not json");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "VALIDATION_ERROR" });
  });

  it("stores nothing when the input is invalid", async () => {
    await post({ ...flour, sku: "" });

    const list = await get("/api/products");
    expect(await list.json()).toMatchObject({ items: [], total: 0 });
  });
});

describe("GET /api/products", () => {
  it("lists, searches, sorts and pages", async () => {
    await post(flour);
    await post({
      ...flour,
      sku: "ACE-GIR-1L",
      name: "Aceite de girasol 1 L",
      unitOfMeasure: "UNIT",
    });

    const all = await getPage();
    expect(all).toMatchObject({ total: 2, page: 1, pageSize: 25 });
    expect(skusOf(all)).toEqual(["ACE-GIR-1L", "HAR-PAN-1K"]);

    const found = await getPage("?q=aceite");
    expect(skusOf(found)).toEqual(["ACE-GIR-1L"]);

    const desc = await getPage("?sort=name&order=desc");
    expect(skusOf(desc)).toEqual(["HAR-PAN-1K", "ACE-GIR-1L"]);

    const beyond = await getPage("?page=2");
    expect(beyond).toMatchObject({ items: [], total: 2, page: 2 });
  });

  it.each(["page=0", "page=abc", "sort=price", "order=up"])(
    "answers 400 VALIDATION_ERROR for ?%s",
    async (query) => {
      const res = await get(`/api/products?${query}`);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    },
  );
});

describe("roles (PLAN → Roles: admin writes, every role reads)", () => {
  let sessions: Sessions;
  beforeEach(async () => {
    sessions = await signInAll(db, testApp);
  });

  it("POST /api/products allows only admin", () =>
    expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: "/api/products", body: flour },
      ["admin"],
      201,
    ));

  it("GET /api/products allows every role", () =>
    expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/products" },
      ["admin", "sales", "purchasing", "warehouse"],
      200,
    ));

  it("a sales user cannot create a product: 403 FORBIDDEN and nothing is stored", async () => {
    session = sessions.sales;

    const res = await post(flour);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
    expect(await getPage()).toMatchObject({ items: [], total: 0 });
  });

  it("refuses the role before validating: an invalid body from sales is 403, not 400", async () => {
    session = sessions.sales;

    const res = await post({ sku: "HAR PAN" });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
  });

  it("a warehouse user lists products", async () => {
    await post(flour);
    session = sessions.warehouse;

    const res = await get("/api/products");

    expect(res.status).toBe(200);
    expect(skusOf((await res.json()) as Page)).toEqual(["HAR-PAN-1K"]);
  });
});

describe("the API in general", () => {
  it("answers unknown routes with the NOT_FOUND ApiError body when signed in", async () => {
    const res = await get("/api/nope");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND" });
  });

  it("describes the products endpoints in /openapi.json, with page as an integer", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<
        string,
        Record<string, { parameters?: { name: string; schema: { type: string } }[] }>
      >;
    };

    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/health", "/api/products"]));
    expect(Object.keys(doc.paths["/api/products"] ?? {}).sort()).toEqual(["get", "post"]);
    const page = doc.paths["/api/products"]?.get?.parameters?.find((p) => p.name === "page");
    expect(page?.schema.type).toBe("integer");
  });

  it("documents the 403 of a refused role on both product operations", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };

    for (const method of ["get", "post"]) {
      expect(Object.keys(doc.paths["/api/products"]?.[method]?.responses ?? {})).toContain("403");
    }
  });
});
