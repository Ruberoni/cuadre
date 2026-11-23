import {
  type CreateSupplierRequest,
  type ListSuppliersQuery,
  ListSuppliersResponse,
  Supplier,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, unwrapOrThrow } from "./client.ts";

function listPath(query: ListSuppliersQuery): string {
  const params = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
  });
  if (query.q !== undefined && query.q !== "") params.set("q", query.q);
  return `/suppliers?${params}`;
}

/** One page of the supplier list. Keeps the previous page on screen while the next one loads. */
export function useSuppliers(query: ListSuppliersQuery, enabled = true) {
  return useQuery({
    queryKey: ["suppliers", query],
    queryFn: async () => unwrapOrThrow(await apiRequest(listPath(query), ListSuppliersResponse)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function createSupplier(request: CreateSupplierRequest) {
  return apiRequest("/suppliers", Supplier, { method: "POST", body: request });
}

/** Creates a supplier and refreshes every cached list. Resolves to the `Result`, never throws. */
export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: (result) => {
      if (result.ok) return queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
