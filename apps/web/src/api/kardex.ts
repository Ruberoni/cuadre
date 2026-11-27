import { KardexResponse } from "@cuadre/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest, unwrapOrThrow } from "@/api/client";

export const KARDEX_QUERY_KEY = ["kardex"] as const;

export function useKardex(productId: string | undefined, page: number, enabled = true) {
  const params = new URLSearchParams({ page: String(page) });
  return useQuery({
    queryKey: [...KARDEX_QUERY_KEY, productId, page],
    queryFn: async () => {
      if (productId === undefined) throw new Error("productId is required");
      return unwrapOrThrow(
        await apiRequest(`/kardex/${encodeURIComponent(productId)}?${params}`, KardexResponse),
      );
    },
    placeholderData: keepPreviousData,
    enabled: enabled && productId !== undefined && productId !== "",
  });
}
