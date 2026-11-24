import { createCustomerUseCase } from "../application/create-customer.ts";
import { createSupplierUseCase } from "../application/create-supplier.ts";
import type { PartnerRepository } from "../application/partner-repository.ts";
import type { CustomerInput, SupplierInput } from "../domain/partner.ts";

/** Realistic fictitious Venezuelan suppliers for local dev and demos; safe to run more than once. */
const DEMO_SUPPLIERS: readonly SupplierInput[] = [
  {
    rif: "J-30123456-1",
    name: "Distribuidora Andina, C.A.",
    phone: "+58 212-555-0101",
    email: "ventas@andina.test",
    address: "Zona Industrial La Yaguara, Caracas",
  },
  {
    rif: "J-40234567-4",
    name: "Alimentos del Sur, C.A.",
    phone: "+58 241-555-0142",
    email: "pedidos@alimentosdelsur.test",
    address: "Zona Industrial Sur, Valencia",
  },
  {
    rif: "J-31456789-6",
    name: "Inversiones Caribeño, S.A.",
    phone: "+58 281-555-0188",
    email: "contacto@caribeno.test",
    address: "Av. Intercomunal, Barcelona",
  },
  {
    rif: "J-29876543-7",
    name: "Comercializadora Los Llanos, C.A.",
    phone: "+58 251-555-0115",
    email: "compras@losllanos.test",
    address: "Zona Industrial II, Barquisimeto",
  },
  {
    rif: "J-40512345-1",
    name: "Importadora Oriental, C.A.",
    phone: "+58 286-555-0190",
    email: "info@importadoraoriental.test",
    address: "Zona Industrial Matanzas, Puerto Ordaz",
  },
];

/** Realistic fictitious Venezuelan customers (companies and individuals); keeps J-30123456-1 supplier-only. */
const DEMO_CUSTOMERS: readonly CustomerInput[] = [
  {
    rif: "J-40987654-3",
    name: "Abastos La Esquina, C.A.",
    phone: "+58 212-555-0201",
    email: "compras@laesquina.test",
    address: "Av. Francisco de Miranda, Chacao, Caracas",
  },
  {
    rif: "V-12345678-1",
    name: "María Elena González",
    phone: "+58 414-555-0212",
    email: "maria.gonzalez@correo.test",
    address: "Urb. El Rosal, Caracas",
  },
  {
    rif: "J-30812345-5",
    name: "Supermercado El Progreso, C.A.",
    phone: "+58 241-555-0233",
    email: "administracion@elprogreso.test",
    address: "Av. Bolívar Norte, Valencia",
  },
  {
    rif: "J-41205678-6",
    name: "Bodegón Central, C.A.",
    phone: "+58 251-555-0244",
    email: "pedidos@bodegoncentral.test",
    address: "Av. Lara, Barquisimeto",
  },
  {
    rif: "V-18456123-5",
    name: "Carlos Alberto Mendoza",
    phone: "+58 412-555-0255",
    email: "carlos.mendoza@correo.test",
    address: "Urb. Las Mercedes, Caracas",
  },
];

export async function seedPartners(partners: PartnerRepository): Promise<number> {
  let created = 0;
  for (const supplier of DEMO_SUPPLIERS) {
    const result = await createSupplierUseCase(partners, supplier);
    if (result.ok) {
      created += 1;
    } else if (result.error !== "RIF_ALREADY_EXISTS") {
      throw new Error(`Demo supplier ${supplier.rif} failed validation: ${result.error}`);
    }
  }
  for (const customer of DEMO_CUSTOMERS) {
    const result = await createCustomerUseCase(partners, customer);
    if (result.ok) {
      created += 1;
    } else if (result.error !== "RIF_ALREADY_EXISTS") {
      throw new Error(`Demo customer ${customer.rif} failed validation: ${result.error}`);
    }
  }
  return created;
}
