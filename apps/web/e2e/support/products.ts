import type { APIRequestContext } from "@playwright/test";
import { signInRequest } from "./auth.ts";

export const apiUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3100}`;

type NewProduct = {
  sku: string;
  name: string;
  unitOfMeasure?: "UNIT" | "BOX" | "BULK" | "KILOGRAM" | "LITER";
  minorUnits?: number;
  taxRate?: "GENERAL" | "REDUCED" | "EXEMPT";
};

/**
 * Creates a product through the API, the way the acceptance examples say "Given X exists". Signs
 * the request context in as the seeded admin first (the API needs a session).
 */
export async function givenProduct(request: APIRequestContext, product: NewProduct): Promise<void> {
  await signInRequest(request, apiUrl);
  const response = await request.post(`${apiUrl}/api/products`, {
    data: {
      sku: product.sku,
      name: product.name,
      unitOfMeasure: product.unitOfMeasure ?? "UNIT",
      salePrice: { minorUnits: product.minorUnits ?? 100, currency: "USD" },
      taxRate: product.taxRate ?? "GENERAL",
    },
  });
  if (!response.ok()) throw new Error(`Could not create ${product.sku}: ${response.status()}`);
}
