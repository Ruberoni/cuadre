import type { APIRequestContext } from "@playwright/test";
import { signInRequest } from "./auth.ts";
import { apiUrl } from "./products.ts";

type NewSupplier = {
  rif: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

/**
 * Creates a supplier through the API, the way the acceptance examples say "Given X exists". Signs
 * the request context in as the seeded admin first (the API needs a session).
 */
export async function givenSupplier(
  request: APIRequestContext,
  supplier: NewSupplier,
): Promise<void> {
  await signInRequest(request, apiUrl);
  const response = await request.post(`${apiUrl}/api/suppliers`, {
    data: {
      rif: supplier.rif,
      name: supplier.name,
      ...(supplier.phone === undefined ? {} : { phone: supplier.phone }),
      ...(supplier.email === undefined ? {} : { email: supplier.email }),
      ...(supplier.address === undefined ? {} : { address: supplier.address }),
    },
  });
  if (!response.ok()) throw new Error(`Could not create ${supplier.rif}: ${response.status()}`);
}
