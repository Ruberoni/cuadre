import {
  type CustomerInput,
  type CustomerValidationFailure,
  createCustomer,
  type Partner,
} from "../domain/partner.ts";
import type { PartnerRepository } from "./partner-repository.ts";

export type CreateCustomerInput = CustomerInput & {
  readonly confirmExistingPartner?: boolean | undefined;
};

export type CreateCustomerResult =
  | { ok: true; value: Partner; promoted: boolean }
  | { ok: false; error: "RIF_ALREADY_EXISTS"; rif: string }
  | { ok: false; error: "PARTNER_ALREADY_EXISTS"; rif: string; partnerName: string }
  | CustomerValidationFailure;

export async function createCustomerUseCase(
  partners: PartnerRepository,
  input: CreateCustomerInput,
): Promise<CreateCustomerResult> {
  const customer = createCustomer(input);
  if (!customer.ok) return customer;

  const stored = await partners.saveForRole(customer.value, "customer", {
    confirmExistingPartner: input.confirmExistingPartner === true,
  });
  if (stored.ok) return stored;
  if (stored.error === "PARTNER_ALREADY_EXISTS") {
    return {
      ok: false,
      error: "PARTNER_ALREADY_EXISTS",
      rif: customer.value.rif,
      partnerName: stored.partnerName,
    };
  }
  return { ok: false, error: stored.error, rif: customer.value.rif };
}
