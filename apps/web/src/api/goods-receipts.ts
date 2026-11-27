import {
  type CreateGoodsReceiptRequest,
  GoodsReceipt,
  type ListGoodsReceiptsQuery,
  ListGoodsReceiptsResponse,
  type UpdateGoodsReceiptRequest,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, unwrapOrThrow } from "@/api/client";
import { KARDEX_QUERY_KEY } from "@/api/kardex";

const GOODS_RECEIPTS_KEY = ["goods-receipts"] as const;
const PURCHASE_ORDERS_KEY = ["purchase-orders"] as const;

export function useGoodsReceipts(query: ListGoodsReceiptsQuery, enabled = true) {
  const params = new URLSearchParams({ page: String(query.page) });
  return useQuery({
    queryKey: [...GOODS_RECEIPTS_KEY, query],
    queryFn: async () =>
      unwrapOrThrow(
        await apiRequest(`/goods-receipts?${params.toString()}`, ListGoodsReceiptsResponse),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useGoodsReceipt(id: string, enabled = true) {
  return useQuery({
    queryKey: [...GOODS_RECEIPTS_KEY, "detail", id],
    queryFn: async () =>
      unwrapOrThrow(await apiRequest(`/goods-receipts/${encodeURIComponent(id)}`, GoodsReceipt)),
    enabled,
  });
}

export function useCreateGoodsReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGoodsReceiptRequest) =>
      apiRequest("/goods-receipts", GoodsReceipt, { method: "POST", body }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: GOODS_RECEIPTS_KEY });
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useUpdateGoodsReceipt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGoodsReceiptRequest) =>
      apiRequest(`/goods-receipts/${encodeURIComponent(id)}`, GoodsReceipt, {
        method: "PUT",
        body,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: GOODS_RECEIPTS_KEY });
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useDeleteGoodsReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/goods-receipts/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE" }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: GOODS_RECEIPTS_KEY });
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
      }
    },
  });
}

export function useIssueGoodsReceipt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/goods-receipts/${encodeURIComponent(id)}/issue`, GoodsReceipt, {
        method: "POST",
      }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData([...GOODS_RECEIPTS_KEY, "detail", id], result.value);
        void queryClient.invalidateQueries({ queryKey: GOODS_RECEIPTS_KEY });
        void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_KEY });
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: KARDEX_QUERY_KEY });
      }
    },
  });
}
