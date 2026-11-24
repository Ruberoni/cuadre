import type { APIRequestContext } from "@playwright/test";
import { signInRequest } from "./auth.ts";
import { apiUrl } from "./products.ts";

export type NewPartnerFixture = {
  rif: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

/**
 * Creates a supplier or customer through the API, the way the acceptance examples say "Given X
 * exists". Signs the request context in as the seeded admin first (the API needs a session).
 */
export async function givenPartner(
  request: APIRequestContext,
  resource: "/suppliers" | "/customers",
  partner: NewPartnerFixture,
): Promise<void> {
  await signInRequest(request, apiUrl);
  const response = await request.post(`${apiUrl}/api${resource}`, {
    data: {
      rif: partner.rif,
      name: partner.name,
      ...(partner.phone === undefined ? {} : { phone: partner.phone }),
      ...(partner.email === undefined ? {} : { email: partner.email }),
      ...(partner.address === undefined ? {} : { address: partner.address }),
    },
  });
  if (!response.ok()) throw new Error(`Could not create ${partner.rif}: ${response.status()}`);
}

export function givenSupplier(
  request: APIRequestContext,
  supplier: NewPartnerFixture,
): Promise<void> {
  return givenPartner(request, "/suppliers", supplier);
}

export function givenCustomer(
  request: APIRequestContext,
  customer: NewPartnerFixture,
): Promise<void> {
  return givenPartner(request, "/customers", customer);
}
