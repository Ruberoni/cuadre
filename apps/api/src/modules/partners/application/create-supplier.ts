import {
  createSupplier,
  type Partner,
  type SupplierInput,
  type SupplierValidationFailure,
} from "../domain/partner.ts";
import type { PartnerRepository } from "./partner-repository.ts";

export type CreateSupplierInput = SupplierInput & {
  readonly confirmExistingPartner?: boolean | undefined;
};

export type CreateSupplierResult =
  | { ok: true; value: Partner; promoted: boolean }
  | { ok: false; error: "RIF_ALREADY_EXISTS"; rif: string }
  | { ok: false; error: "PARTNER_ALREADY_EXISTS"; rif: string; partnerName: string }
  | SupplierValidationFailure;

export async function createSupplierUseCase(
  partners: PartnerRepository,
  input: CreateSupplierInput,
): Promise<CreateSupplierResult> {
  const supplier = createSupplier(input);
  if (!supplier.ok) return supplier;

  const stored = await partners.saveForRole(supplier.value, "supplier", {
    confirmExistingPartner: input.confirmExistingPartner === true,
  });
  if (stored.ok) return stored;
  if (stored.error === "PARTNER_ALREADY_EXISTS") {
    return {
      ok: false,
      error: "PARTNER_ALREADY_EXISTS",
      rif: supplier.value.rif,
      partnerName: stored.partnerName,
    };
  }
  return { ok: false, error: stored.error, rif: supplier.value.rif };
}
