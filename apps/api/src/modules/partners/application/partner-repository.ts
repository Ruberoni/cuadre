import type { PartnerRole, PartnerSortField } from "@cuadre/contracts";
import type { DbExecutor } from "../../../db/client.ts";
import type { NewPartner, Partner } from "../domain/partner.ts";

export type PartnerListParams = {
  readonly search?: string;
  readonly sort: PartnerSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
  readonly pageSize: number;
};

export type PartnerListPage = {
  readonly items: readonly Partner[];
  readonly total: number;
};

export type SavePartnerResult =
  | { ok: true; value: Partner; promoted: boolean }
  | { ok: false; error: "RIF_ALREADY_EXISTS" }
  | { ok: false; error: "PARTNER_ALREADY_EXISTS"; partnerName: string };

export type PartnerRepository = {
  saveForRole(
    partner: NewPartner,
    role: PartnerRole,
    options: { readonly confirmExistingPartner: boolean },
  ): Promise<SavePartnerResult>;
  listByRole(role: PartnerRole, params: PartnerListParams): Promise<PartnerListPage>;
  findSupplierById(id: string, tx?: DbExecutor): Promise<Partner | null>;
  findSuppliersByIds(ids: readonly string[], tx?: DbExecutor): Promise<Map<string, Partner>>;
};
