import type { Partner as PartnerDto } from "@cuadre/contracts";
import type { Partner } from "../domain/partner.ts";

export function toPartnerDto(partner: Partner): PartnerDto {
  return {
    id: partner.id,
    rif: partner.rif,
    name: partner.name,
    phone: partner.phone,
    email: partner.email,
    address: partner.address,
  };
}
