import type { ListPartnersQuery } from "@cuadre/contracts";

export function partnerListPath(
  resource: "/suppliers" | "/customers",
  query: ListPartnersQuery,
): string {
  const params = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
  });
  if (query.q !== undefined && query.q !== "") params.set("q", query.q);
  return `${resource}?${params}`;
}
