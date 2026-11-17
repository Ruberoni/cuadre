import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createDrizzleProductRepository } from "../infrastructure/drizzle-product-repository.ts";
import { seedProducts } from "../infrastructure/seed-products.ts";
import { createProductUseCase } from "./create-product.ts";
import { listProductsUseCase } from "./list-products.ts";

const { db, close } = createDb(testDatabaseUrl());
const products = createDrizzleProductRepository(db);

const flour = {
  sku: "HAR-PAN-1K",
  name: "Harina de maíz precocida 1 kg",
  unitOfMeasure: "BULK",
  salePrice: { minorUnits: 145, currency: "USD" },
  taxRate: "EXEMPT",
} as const;

const defaultList = { sort: "sku", order: "asc", page: 1 } as const;
const skus = (page: { items: { sku: string }[] }) => page.items.map((item) => item.sku);

const create = (sku: string, name: string, minorUnits = 100) =>
  createProductUseCase(products, {
    ...flour,
    sku,
    name,
    salePrice: { minorUnits, currency: "USD" },
  });

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("createProductUseCase", () => {
  it("stores the product, with the price as 145 minor units in USD", async () => {
    const result = await createProductUseCase(products, flour);

    expect(result.ok).toBe(true);
    const page = await listProductsUseCase(products, defaultList);
    expect(page.items).toEqual([
      {
        id: expect.any(String),
        sku: "HAR-PAN-1K",
        name: "Harina de maíz precocida 1 kg",
        unitOfMeasure: "BULK",
        salePrice: { minorUnits: 145, currency: "USD" },
        taxRate: "EXEMPT",
      },
    ]);
  });

  it("fails with SKU_ALREADY_EXISTS, naming the code, when it is taken", async () => {
    await createProductUseCase(products, flour);

    const again = await createProductUseCase(products, { ...flour, name: "Otro producto" });

    expect(again).toEqual({ ok: false, error: "SKU_ALREADY_EXISTS", sku: "HAR-PAN-1K" });
    expect((await listProductsUseCase(products, defaultList)).total).toBe(1);
  });

  it("normalises the code to uppercase, so the lowercase twin is a duplicate", async () => {
    const first = await createProductUseCase(products, { ...flour, sku: "har-pan-1k" });
    expect(first.ok && first.value.sku).toBe("HAR-PAN-1K");

    const second = await createProductUseCase(products, flour);

    expect(second).toEqual({ ok: false, error: "SKU_ALREADY_EXISTS", sku: "HAR-PAN-1K" });
  });

  it("creates the same code only once when requests race", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createProductUseCase(products, flour)),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results.filter((result) => !result.ok && result.error === "SKU_ALREADY_EXISTS"),
    ).toHaveLength(4);
  });

  it("reports validation issues without touching the database", async () => {
    const result = await createProductUseCase(products, { ...flour, sku: "HAR PAN" });

    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "sku", code: "INVALID_FORMAT" }],
    });
    expect((await listProductsUseCase(products, defaultList)).total).toBe(0);
  });
});

describe("listProductsUseCase", () => {
  it("sorts by code ascending and pages by 25: 30 products show 25, then 5", async () => {
    for (let i = 1; i <= 30; i++) await create(`P-${String(i).padStart(2, "0")}`, `Producto ${i}`);

    const first = await listProductsUseCase(products, defaultList);
    const second = await listProductsUseCase(products, { ...defaultList, page: 2 });

    expect(first.items).toHaveLength(25);
    expect(first).toMatchObject({ total: 30, page: 1, pageSize: 25 });
    expect(first.items[0]?.sku).toBe("P-01");
    expect(first.items[24]?.sku).toBe("P-25");
    expect(skus(second)).toEqual(["P-26", "P-27", "P-28", "P-29", "P-30"]);
  });

  it("orders codes the same way on every database (C collation: digits before letters)", async () => {
    for (const sku of ["B-1", "A-2", "A-10", "1-X", "A-1"]) await create(sku, `Producto ${sku}`);

    const page = await listProductsUseCase(products, defaultList);

    expect(skus(page)).toEqual(["1-X", "A-1", "A-10", "A-2", "B-1"]);
  });

  it("sorts by name and by price, either direction, with the code as tiebreaker", async () => {
    await create("B", "Arroz", 300);
    await create("A", "Harina", 100);
    await create("C", "Arroz", 100);

    expect(skus(await listProductsUseCase(products, { ...defaultList, sort: "name" }))).toEqual([
      "B",
      "C",
      "A",
    ]);
    expect(
      skus(await listProductsUseCase(products, { sort: "salePrice", order: "desc", page: 1 })),
    ).toEqual(["B", "A", "C"]);
  });

  describe("search", () => {
    beforeEach(async () => {
      await createProductUseCase(products, flour);
      await create("ACE-GIR-1L", "Aceite de girasol 1 L");
    });

    it("finds by a part of the name, ignoring case", async () => {
      const page = await listProductsUseCase(products, { ...defaultList, q: "aceite" });
      expect(skus(page)).toEqual(["ACE-GIR-1L"]);
      expect(page.total).toBe(1);
    });

    it("finds by a part of the code", async () => {
      expect(skus(await listProductsUseCase(products, { ...defaultList, q: "HAR-" }))).toEqual([
        "HAR-PAN-1K",
      ]);
      expect(skus(await listProductsUseCase(products, { ...defaultList, q: "har-pan" }))).toEqual([
        "HAR-PAN-1K",
      ]);
    });

    it("returns nothing, with total 0, when nothing matches", async () => {
      expect(await listProductsUseCase(products, { ...defaultList, q: "xyz" })).toMatchObject({
        items: [],
        total: 0,
      });
    });

    it("ignores a blank search", async () => {
      expect((await listProductsUseCase(products, { ...defaultList, q: "  " })).total).toBe(2);
    });

    it.each(["%", "_", "\\", "A%E"])("matches %j literally, not as a wildcard", async (q) => {
      expect((await listProductsUseCase(products, { ...defaultList, q })).total).toBe(0);
    });

    it("finds a name that contains a wildcard character as text", async () => {
      await create("PERCENT-1", "Descuento 50% extra");
      expect(skus(await listProductsUseCase(products, { ...defaultList, q: "50%" }))).toEqual([
        "PERCENT-1",
      ]);
    });
  });
});

describe("seedProducts", () => {
  it("loads more than one page of products and can run again without duplicating", async () => {
    const created = await seedProducts(products);
    const again = await seedProducts(products);

    expect(created).toBeGreaterThan(25);
    expect(again).toBe(0);
    expect((await listProductsUseCase(products, defaultList)).total).toBe(created);
  });
});
