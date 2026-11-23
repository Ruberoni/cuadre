import type { SupplierField, SupplierIssueCode } from "@cuadre/contracts";
import {
  err,
  type FieldIssue,
  invalid,
  ok,
  parseRif,
  type Result,
  type Rif,
  type ValidationFailure,
} from "@cuadre/shared-kernel";
import { parsePartnerAddress, parsePartnerEmail, parsePartnerPhone } from "./partner-contact.ts";
import { type PartnerName, parsePartnerName } from "./partner-name.ts";

/** What a caller sends to create a supplier: untrusted text, checked by `createSupplier`. */
export type SupplierInput = {
  readonly rif: string;
  readonly name: string;
  readonly phone?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly address?: string | null | undefined;
};

/** A valid partner that has not been stored yet. */
export type NewPartner = {
  readonly rif: Rif;
  readonly name: PartnerName;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly isSupplier: boolean;
  readonly isCustomer: boolean;
};

export type Partner = NewPartner & { readonly id: string };

export type SupplierFieldIssue = FieldIssue<SupplierField, SupplierIssueCode>;
export type SupplierValidationFailure = ValidationFailure<SupplierField, SupplierIssueCode>;

/** Enforces every supplier rule and reports all invalid fields at once. */
export function createSupplier(
  input: SupplierInput,
): { ok: true; value: NewPartner } | SupplierValidationFailure {
  const rif = parseRif(input.rif);
  const name = parsePartnerName(input.name);
  const phone = parsePartnerPhone(input.phone);
  const email = parsePartnerEmail(input.email);
  const address = parsePartnerAddress(input.address);

  const issues: SupplierFieldIssue[] = [];
  if (!rif.ok) issues.push({ field: "rif", code: rif.error });
  if (!name.ok) issues.push({ field: "name", code: name.error });
  if (!phone.ok) issues.push({ field: "phone", code: phone.error });
  if (!email.ok) issues.push({ field: "email", code: email.error });
  if (!address.ok) issues.push({ field: "address", code: address.error });

  if (!rif.ok || !name.ok || !phone.ok || !email.ok || !address.ok) {
    return invalid(issues);
  }

  return ok({
    rif: rif.value,
    name: name.value,
    phone: phone.value,
    email: email.value,
    address: address.value,
    isSupplier: true,
    isCustomer: false,
  });
}

export type PartnerRowInput = {
  readonly id: string;
  readonly rif: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly isSupplier: boolean;
  readonly isCustomer: boolean;
};

/** Rebuilds a persisted partner row through the domain rules so corrupt rows fail loudly. */
export function reconstitutePartner(row: PartnerRowInput): Result<Partner, "CORRUPT_PARTNER"> {
  if (!row.isSupplier && !row.isCustomer) return err("CORRUPT_PARTNER");
  const rif = parseRif(row.rif);
  const name = parsePartnerName(row.name);
  const phone = parsePartnerPhone(row.phone);
  const email = parsePartnerEmail(row.email);
  const address = parsePartnerAddress(row.address);

  if (!rif.ok || !name.ok || !phone.ok || !email.ok || !address.ok) {
    return err("CORRUPT_PARTNER");
  }

  return ok({
    id: row.id,
    rif: rif.value,
    name: name.value,
    phone: phone.value,
    email: email.value,
    address: address.value,
    isSupplier: row.isSupplier,
    isCustomer: row.isCustomer,
  });
}
