import {
  type CreateProductRequest,
  type ListProductsQuery,
  ListProductsResponse,
  Product,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, unwrapOrThrow } from "./client.ts";

function listPath(query: ListProductsQuery): string {
  const params = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
  });
  if (query.q !== undefined && query.q !== "") params.set("q", query.q);
  return `/products?${params}`;
}

/** One page of the product list. Keeps the previous page on screen while the next one loads. */
export function useProducts(query: ListProductsQuery) {
  return useQuery({
    queryKey: ["products", query],
    queryFn: async () => unwrapOrThrow(await apiRequest(listPath(query), ListProductsResponse)),
    placeholderData: keepPreviousData,
  });
}

export function createProduct(request: CreateProductRequest) {
  return apiRequest("/products", Product, { method: "POST", body: request });
}

/** Creates a product and refreshes every cached list. Resolves to the `Result`, never throws. */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: (result) => {
      if (result.ok) return queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
