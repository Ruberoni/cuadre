import { SUPPLIERS_PAGE_SIZE, type SupplierSortField } from "@cuadre/contracts";
import type { Partner } from "../domain/partner.ts";
import type { PartnerRepository } from "./partner-repository.ts";

export type ListSuppliersInput = {
  readonly q?: string | undefined;
  readonly sort: SupplierSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
};

export type ListSuppliersOutput = {
  readonly items: readonly Partner[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export async function listSuppliersUseCase(
  partners: PartnerRepository,
  input: ListSuppliersInput,
): Promise<ListSuppliersOutput> {
  const search = input.q?.trim();
  const page = await partners.listByRole("supplier", {
    ...(search === undefined || search === "" ? {} : { search }),
    sort: input.sort,
    order: input.order,
    page: input.page,
    pageSize: SUPPLIERS_PAGE_SIZE,
  });
  return {
    items: page.items,
    total: page.total,
    page: input.page,
    pageSize: SUPPLIERS_PAGE_SIZE,
  };
}
