import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createDrizzlePartnerRepository } from "../infrastructure/drizzle-partner-repository.ts";
import { seedPartners } from "../infrastructure/seed-partners.ts";
import { createSupplierUseCase } from "./create-supplier.ts";
import { listSuppliersUseCase } from "./list-suppliers.ts";

const { db, close } = createDb(testDatabaseUrl());
const partners = createDrizzlePartnerRepository(db);

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("createSupplierUseCase & listSuppliersUseCase", () => {
  it("creates a supplier, normalises its RIF, and returns it in the list", async () => {
    const created = await createSupplierUseCase(partners, {
      rif: "j301234561",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "Ventas@Andina.TEST",
      address: "Zona Industrial La Yaguara, Caracas",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value).toMatchObject({
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
      address: "Zona Industrial La Yaguara, Caracas",
      isSupplier: true,
      isCustomer: false,
    });

    const page = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.rif)).toEqual(["J-30123456-1"]);
  });

  it("rejects a duplicate RIF (even with different casing/hyphens) with RIF_ALREADY_EXISTS", async () => {
    await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });

    const duplicate = await createSupplierUseCase(partners, {
      rif: "j301234561",
      name: "Otra Empresa, C.A.",
    });

    expect(duplicate).toEqual({
      ok: false,
      error: "RIF_ALREADY_EXISTS",
      rif: "J-30123456-1",
    });
  });

  it("searches by legal name and by RIF prefix", async () => {
    await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });
    await createSupplierUseCase(partners, {
      rif: "J-40234567-4",
      name: "Alimentos del Sur, C.A.",
    });

    const byName = await listSuppliersUseCase(partners, {
      q: "andina",
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(byName.items.map((item) => item.name)).toEqual(["Distribuidora Andina, C.A."]);

    const byRif = await listSuppliersUseCase(partners, {
      q: "J-301",
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(byRif.items.map((item) => item.rif)).toEqual(["J-30123456-1"]);
  });

  it("sorts by name and by rif", async () => {
    await createSupplierUseCase(partners, {
      rif: "J-40234567-4",
      name: "Alimentos del Sur, C.A.",
    });
    await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });

    const byName = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(byName.items.map((item) => item.name)).toEqual([
      "Alimentos del Sur, C.A.",
      "Distribuidora Andina, C.A.",
    ]);

    const byRif = await listSuppliersUseCase(partners, { sort: "rif", order: "asc", page: 1 });
    expect(byRif.items.map((item) => item.rif)).toEqual(["J-30123456-1", "J-40234567-4"]);
  });

  it("seeds demo suppliers idempotently", async () => {
    const first = await seedPartners(partners);
    const second = await seedPartners(partners);

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });
});
