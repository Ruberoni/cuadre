import type { SupplierSortField } from "@cuadre/contracts";
import type { Result } from "@cuadre/shared-kernel";
import type { NewPartner, Partner } from "../domain/partner.ts";

export type SupplierListParams = {
  readonly search?: string;
  readonly sort: SupplierSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
  readonly pageSize: number;
};

export type SupplierListPage = {
  readonly items: readonly Partner[];
  readonly total: number;
};

export type PartnerRepository = {
  insert(partner: NewPartner): Promise<Result<Partner, "RIF_ALREADY_EXISTS">>;
  listSuppliers(params: SupplierListParams): Promise<SupplierListPage>;
};
