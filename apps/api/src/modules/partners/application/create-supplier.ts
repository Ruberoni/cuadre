import {
  createSupplier,
  type Partner,
  type SupplierInput,
  type SupplierValidationFailure,
} from "../domain/partner.ts";
import type { PartnerRepository } from "./partner-repository.ts";

export type CreateSupplierResult =
  | { ok: true; value: Partner }
  | { ok: false; error: "RIF_ALREADY_EXISTS"; rif: string }
  | SupplierValidationFailure;

export async function createSupplierUseCase(
  partners: PartnerRepository,
  input: SupplierInput,
): Promise<CreateSupplierResult> {
  const supplier = createSupplier(input);
  if (!supplier.ok) return supplier;
  const stored = await partners.insert(supplier.value);
  if (stored.ok) return stored;
  return { ok: false, error: stored.error, rif: supplier.value.rif };
}
