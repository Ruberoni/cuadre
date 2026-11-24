import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createDrizzlePartnerRepository } from "../infrastructure/drizzle-partner-repository.ts";
import { createCustomerUseCase } from "./create-customer.ts";
import { createSupplierUseCase } from "./create-supplier.ts";
import { listCustomersUseCase } from "./list-customers.ts";
import { listSuppliersUseCase } from "./list-suppliers.ts";

const { db, close } = createDb(testDatabaseUrl());
const partners = createDrizzlePartnerRepository(db);

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("createCustomerUseCase & listCustomersUseCase", () => {
  it("creates a company customer, normalises its RIF, and keeps it out of suppliers", async () => {
    const created = await createCustomerUseCase(partners, {
      rif: "j409876543",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: "Compras@LaEsquina.TEST",
      address: "Av. Francisco de Miranda, Chacao, Caracas",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.promoted).toBe(false);
    expect(created.value).toMatchObject({
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: "compras@laesquina.test",
      address: "Av. Francisco de Miranda, Chacao, Caracas",
      isSupplier: false,
      isCustomer: true,
    });

    const customers = await listCustomersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(customers.total).toBe(1);
    expect(customers.items.map((item) => item.rif)).toEqual(["J-40987654-3"]);

    const suppliers = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(suppliers.total).toBe(0);
  });

  it("accepts an individual customer with RIF V-12345678-1", async () => {
    const created = await createCustomerUseCase(partners, {
      rif: "V-12345678-1",
      name: "María Elena González",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.rif).toBe("V-12345678-1");
    expect(created.value.isCustomer).toBe(true);
    expect(created.value.isSupplier).toBe(false);
  });

  it("rejects a duplicate customer RIF with RIF_ALREADY_EXISTS (even when confirming)", async () => {
    await createCustomerUseCase(partners, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    const duplicate = await createCustomerUseCase(partners, {
      rif: "j409876543",
      name: "Otro Cliente, C.A.",
    });
    expect(duplicate).toEqual({
      ok: false,
      error: "RIF_ALREADY_EXISTS",
      rif: "J-40987654-3",
    });

    const duplicateConfirmed = await createCustomerUseCase(partners, {
      rif: "j409876543",
      name: "Otro Cliente, C.A.",
      confirmExistingPartner: true,
    });
    expect(duplicateConfirmed).toEqual({
      ok: false,
      error: "RIF_ALREADY_EXISTS",
      rif: "J-40987654-3",
    });
  });

  it("searches by legal name and by RIF prefix and excludes supplier-only partners", async () => {
    await createCustomerUseCase(partners, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });
    await createCustomerUseCase(partners, {
      rif: "V-12345678-1",
      name: "María Elena González",
    });
    await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });

    const all = await listCustomersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(all.total).toBe(2);
    expect(all.items.map((item) => item.rif)).toEqual(["J-40987654-3", "V-12345678-1"]);

    const supplierSearch = await listCustomersUseCase(partners, {
      q: "andina",
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(supplierSearch.total).toBe(0);

    const byName = await listCustomersUseCase(partners, {
      q: "esquina",
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(byName.items.map((item) => item.name)).toEqual(["Abastos La Esquina, C.A."]);

    const byRif = await listCustomersUseCase(partners, {
      q: "V-123",
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(byRif.items.map((item) => item.rif)).toEqual(["V-12345678-1"]);
  });

  it("sorts by name and by rif", async () => {
    await createCustomerUseCase(partners, {
      rif: "V-12345678-1",
      name: "María Elena González",
    });
    await createCustomerUseCase(partners, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    const byName = await listCustomersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(byName.items.map((item) => item.name)).toEqual([
      "Abastos La Esquina, C.A.",
      "María Elena González",
    ]);

    const byRif = await listCustomersUseCase(partners, { sort: "rif", order: "asc", page: 1 });
    expect(byRif.items.map((item) => item.rif)).toEqual(["J-40987654-3", "V-12345678-1"]);
  });

  it("warns on an existing supplier RIF and promotes it on confirm keeping legal name and contact fields", async () => {
    const supplier = await createSupplierUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
      address: "Zona Industrial La Yaguara, Caracas",
    });
    expect(supplier.ok).toBe(true);
    if (!supplier.ok) return;

    const warned = await createCustomerUseCase(partners, {
      rif: "j301234561",
      name: "Nombre Diferente, C.A.",
      phone: "+58 414-999-9999",
      email: "otro@correo.test",
      address: "Otra dirección",
    });
    expect(warned).toEqual({
      ok: false,
      error: "PARTNER_ALREADY_EXISTS",
      rif: "J-30123456-1",
      partnerName: "Distribuidora Andina, C.A.",
    });

    // Unconfirmed attempt must not add the partner to customers.
    const beforeConfirm = await listCustomersUseCase(partners, {
      sort: "name",
      order: "asc",
      page: 1,
    });
    expect(beforeConfirm.total).toBe(0);

    const confirmed = await createCustomerUseCase(partners, {
      rif: "j301234561",
      name: "Nombre Diferente, C.A.",
      phone: "+58 414-999-9999",
      email: "otro@correo.test",
      address: "Otra dirección",
      confirmExistingPartner: true,
    });
    expect(confirmed).toEqual({
      ok: true,
      promoted: true,
      value: {
        id: supplier.value.id,
        rif: "J-30123456-1",
        name: "Distribuidora Andina, C.A.",
        phone: "+58 212-555-0101",
        email: "ventas@andina.test",
        address: "Zona Industrial La Yaguara, Caracas",
        isSupplier: true,
        isCustomer: true,
      },
    });

    const customers = await listCustomersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(customers.items.map((item) => item.id)).toEqual([supplier.value.id]);

    const suppliers = await listSuppliersUseCase(partners, { sort: "name", order: "asc", page: 1 });
    expect(suppliers.items.map((item) => item.id)).toEqual([supplier.value.id]);

    // Confirming again once it already holds the customer role fails as duplicate.
    const secondConfirm = await createCustomerUseCase(partners, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      confirmExistingPartner: true,
    });
    expect(secondConfirm).toEqual({
      ok: false,
      error: "RIF_ALREADY_EXISTS",
      rif: "J-30123456-1",
    });
  });
});
