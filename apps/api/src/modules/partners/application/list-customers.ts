import { CUSTOMERS_PAGE_SIZE, type CustomerSortField } from "@cuadre/contracts";
import type { Partner } from "../domain/partner.ts";
import type { PartnerRepository } from "./partner-repository.ts";

export type ListCustomersInput = {
  readonly q?: string | undefined;
  readonly sort: CustomerSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
};

export type ListCustomersOutput = {
  readonly items: readonly Partner[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export async function listCustomersUseCase(
  partners: PartnerRepository,
  input: ListCustomersInput,
): Promise<ListCustomersOutput> {
  const search = input.q?.trim();
  const page = await partners.listByRole("customer", {
    ...(search === undefined || search === "" ? {} : { search }),
    sort: input.sort,
    order: input.order,
    page: input.page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  });
  return {
    items: page.items,
    total: page.total,
    page: input.page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  };
}
