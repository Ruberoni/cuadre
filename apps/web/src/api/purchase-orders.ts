import {
  type ListPurchaseOrdersQuery,
  ListPurchaseOrdersResponse,
  PurchaseOrder,
  type SavePurchaseOrderRequest,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, unwrapOrThrow } from "@/api/client";

const PURCHASE_ORDERS_KEY = ["purchase-orders"] as const;

export function usePurchaseOrders(query: ListPurchaseOrdersQuery, enabled = true) {
  const params = new URLSearchParams({ page: String(query.page) });
  return useQuery({
    queryKey: [...PURCHASE_ORDERS_KEY, query],
    queryFn: async () =>
      unwrapOrThrow(
        await apiRequest(`/purchase-orders?${params.toString()}`, ListPurchaseOrdersResponse),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePurchaseOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: [...PURCHASE_ORDERS_KEY, "detail", id],
    queryFn: async () =>
      unwrapOrThrow(await apiRequest(`/purchase-orders/${encodeURIComponent(id)}`, PurchaseOrder)),
    enabled,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePurchaseOrderRequest) =>
      apiRequest("/purchase-orders", PurchaseOrder, { method: "POST", body }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useUpdatePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePurchaseOrderRequest) =>
      apiRequest(`/purchase-orders/${encodeURIComponent(id)}`, PurchaseOrder, {
        method: "PUT",
        body,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/purchase-orders/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE" }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useIssuePurchaseOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/purchase-orders/${encodeURIComponent(id)}/issue`, PurchaseOrder, {
        method: "POST",
      }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData([...PURCHASE_ORDERS_KEY, "detail", id], result.value);
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}
