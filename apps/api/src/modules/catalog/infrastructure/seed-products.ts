import type { TaxRate, UnitOfMeasure } from "@cuadre/contracts";
import { createProductUseCase } from "../application/create-product.ts";
import type { ProductRepository } from "../application/product-repository.ts";

type SeedProduct = readonly [
  sku: string,
  name: string,
  unit: UnitOfMeasure,
  /** USD cents, excluding IVA. */
  priceMinor: number,
  tax: TaxRate,
];

/** Fictitious catalog of a small Venezuelan food and household distributor. More than one page. */
const PRODUCTS: readonly SeedProduct[] = [
  ["HAR-PAN-1K", "Harina de maíz precocida 1 kg", "BULK", 145, "EXEMPT"],
  ["HAR-TRI-1K", "Harina de trigo todo uso 1 kg", "BULK", 160, "EXEMPT"],
  ["ARR-BLA-1K", "Arroz blanco tipo 1 1 kg", "BULK", 135, "EXEMPT"],
  ["ARR-INT-1K", "Arroz integral 1 kg", "BULK", 210, "GENERAL"],
  ["PAS-LAR-500", "Pasta larga espagueti 500 g", "BOX", 95, "EXEMPT"],
  ["PAS-COR-500", "Pasta corta codito 500 g", "BOX", 95, "EXEMPT"],
  ["ACE-GIR-1L", "Aceite de girasol 1 L", "UNIT", 320, "EXEMPT"],
  ["ACE-MAI-1L", "Aceite de maíz 1 L", "UNIT", 345, "EXEMPT"],
  ["ACE-OLI-500", "Aceite de oliva extra virgen 500 ml", "UNIT", 890, "GENERAL"],
  ["AZU-BLA-1K", "Azúcar refinada 1 kg", "BULK", 150, "EXEMPT"],
  ["AZU-MOR-1K", "Azúcar morena 1 kg", "BULK", 165, "EXEMPT"],
  ["SAL-MAR-1K", "Sal marina fina 1 kg", "BULK", 70, "EXEMPT"],
  ["CAR-NEG-500", "Caraotas negras 500 g", "UNIT", 130, "EXEMPT"],
  ["LEN-ROJ-500", "Lentejas rojas 500 g", "UNIT", 140, "EXEMPT"],
  ["GRA-BLA-500", "Granos blancos 500 g", "UNIT", 125, "EXEMPT"],
  ["CAF-MOL-250", "Café molido tostado 250 g", "UNIT", 380, "REDUCED"],
  ["CAF-MOL-500", "Café molido tostado 500 g", "UNIT", 720, "REDUCED"],
  ["LEC-POL-400", "Leche en polvo completa 400 g", "UNIT", 560, "REDUCED"],
  ["LEC-LIQ-1L", "Leche líquida larga vida 1 L", "BOX", 195, "REDUCED"],
  ["MAN-VEG-500", "Margarina vegetal 500 g", "UNIT", 240, "REDUCED"],
  ["ATU-LAT-170", "Atún en aceite lata 170 g", "BOX", 210, "GENERAL"],
  ["SAR-TOM-170", "Sardinas en salsa de tomate 170 g", "BOX", 125, "GENERAL"],
  ["SAL-TOM-190", "Salsa de tomate 190 g", "UNIT", 110, "GENERAL"],
  ["MAY-FRA-445", "Mayonesa 445 g", "UNIT", 330, "GENERAL"],
  ["GAL-MAR-200", "Galletas María 200 g", "BOX", 85, "GENERAL"],
  ["GAL-SAL-180", "Galletas saladas 180 g", "BOX", 90, "GENERAL"],
  ["REF-COL-2L", "Refresco de cola 2 L", "BOX", 190, "GENERAL"],
  ["REF-NAR-2L", "Refresco de naranja 2 L", "BOX", 185, "GENERAL"],
  ["AGU-MIN-5L", "Agua mineral 5 L", "BOX", 150, "GENERAL"],
  ["JUG-NAR-1L", "Jugo de naranja 1 L", "BOX", 210, "GENERAL"],
  ["DET-POL-1K", "Detergente en polvo 1 kg", "UNIT", 420, "GENERAL"],
  ["DET-LIQ-2L", "Detergente líquido 2 L", "UNIT", 650, "GENERAL"],
  ["JAB-LAV-300", "Jabón de lavar en barra 300 g", "BOX", 160, "GENERAL"],
  ["JAB-TOC-120", "Jabón de tocador 120 g", "BOX", 95, "GENERAL"],
  ["CLO-LIM-1L", "Cloro 1 L", "UNIT", 130, "GENERAL"],
  ["LIM-DES-900", "Desinfectante de pisos 900 ml", "UNIT", 175, "GENERAL"],
  ["PAP-HIG-12", "Papel higiénico paquete de 12 rollos", "BULK", 480, "GENERAL"],
  ["SER-COC-6", "Servilletas de cocina paquete de 6", "BULK", 260, "GENERAL"],
  ["POL-FRE-KG", "Pollo fresco entero", "KILOGRAM", 410, "EXEMPT"],
  ["QUE-BLA-KG", "Queso blanco duro", "KILOGRAM", 780, "REDUCED"],
  ["CHA-PAL-KG", "Chuleta ahumada de cerdo", "KILOGRAM", 690, "GENERAL"],
  ["VIN-TIN-750", "Vinagre blanco 750 ml", "UNIT", 105, "GENERAL"],
  ["LIC-RON-1L", "Ron añejo 1 L", "BOX", 1450, "GENERAL"],
  ["ACE-COC-1L", "Aceite vegetal para freír (garrafa)", "LITER", 300, "EXEMPT"],
];

/**
 * Loads the demo products through the same use case as the API, so they obey every product rule.
 * A code that already exists is skipped, which makes running the seed again harmless.
 */
export async function seedProducts(products: ProductRepository): Promise<number> {
  let created = 0;
  for (const [sku, name, unitOfMeasure, minorUnits, taxRate] of PRODUCTS) {
    const result = await createProductUseCase(products, {
      sku,
      name,
      unitOfMeasure,
      salePrice: { minorUnits, currency: "USD" },
      taxRate,
    });
    if (result.ok) created++;
    else if (result.error !== "SKU_ALREADY_EXISTS") {
      throw new Error(`Seed product ${sku} is invalid: ${JSON.stringify(result)}`);
    }
  }
  return created;
}
