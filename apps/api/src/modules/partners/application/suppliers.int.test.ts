import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createDrizzlePartnerRepository } from "../infrastructure/drizzle-partner-repository.ts";
import { seedPartners } from "../infrastructure/seed-partners.ts";
import { createCustomerUseCase } from "./create-customer.ts";
import { createSupplierUseCase } from "./create-supplier.ts";
import { listCustomersUseCase } from "./list-customers.ts";
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
    expect(created.promoted).toBe(false);
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

  it("searches by legal name and by RIF prefix and excludes customer-only partners", async () => {
    await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });
    await createSupplierUseCase(partners, {
      rif: "J-40234567-4",
      name: "Alimentos del Sur, C.A.",
    });
    await createCustomerUseCase(partners, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    const all = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(all.total).toBe(2);

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

  it("warns on an existing customer RIF and promotes it on confirm keeping legal name and contact fields", async () => {
    const customer = await createCustomerUseCase(partners, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: "compras@laesquina.test",
      address: "Av. Francisco de Miranda, Chacao, Caracas",
    });
    expect(customer.ok).toBe(true);
    if (!customer.ok) return;

    const warned = await createSupplierUseCase(partners, {
      rif: "J-40987654-3",
      name: "Otro Proveedor, C.A.",
    });
    expect(warned).toEqual({
      ok: false,
      error: "PARTNER_ALREADY_EXISTS",
      rif: "J-40987654-3",
      partnerName: "Abastos La Esquina, C.A.",
    });

    const confirmed = await createSupplierUseCase(partners, {
      rif: "J-40987654-3",
      name: "Otro Proveedor, C.A.",
      confirmExistingPartner: true,
    });
    expect(confirmed).toEqual({
      ok: true,
      promoted: true,
      value: {
        id: customer.value.id,
        rif: "J-40987654-3",
        name: "Abastos La Esquina, C.A.",
        phone: "+58 212-555-0201",
        email: "compras@laesquina.test",
        address: "Av. Francisco de Miranda, Chacao, Caracas",
        isSupplier: true,
        isCustomer: true,
      },
    });
  });

  it("seeds demo suppliers and customers idempotently", async () => {
    const first = await seedPartners(partners);
    const second = await seedPartners(partners);

    expect(first).toBe(10);
    expect(second).toBe(0);

    const suppliers = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    const customers = await listCustomersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(suppliers.total).toBe(5);
    expect(customers.total).toBe(5);
  });
});
