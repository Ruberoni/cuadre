import { createSupplierUseCase } from "../application/create-supplier.ts";
import type { PartnerRepository } from "../application/partner-repository.ts";
import type { SupplierInput } from "../domain/partner.ts";

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
  return created;
}
