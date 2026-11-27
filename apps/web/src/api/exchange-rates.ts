import {
  CurrentExchangeRateResponse,
  ExchangeRate,
  ListExchangeRatesResponse,
  type RecordExchangeRateRequest,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, unwrapOrThrow } from "./client.ts";

/** One page of BCV exchange rates, newest first. Keeps the previous page while the next loads. */
export function useExchangeRates(page: number) {
  return useQuery({
    queryKey: ["exchange-rates", "list", page],
    queryFn: async () =>
      unwrapOrThrow(await apiRequest(`/exchange-rates?page=${page}`, ListExchangeRatesResponse)),
    placeholderData: keepPreviousData,
  });
}

/** Active BCV rate on or before today (for the App shell header). */
export function useCurrentExchangeRate(enabled = true) {
  return useQuery({
    queryKey: ["exchange-rates", "current"],
    queryFn: async () =>
      unwrapOrThrow(await apiRequest("/exchange-rates/current", CurrentExchangeRateResponse)),
    enabled,
  });
}

function recordExchangeRate(request: RecordExchangeRateRequest) {
  return apiRequest("/exchange-rates", ExchangeRate, { method: "POST", body: request });
}

function correctExchangeRate({ date, rate }: { date: string; rate: string }) {
  return apiRequest(`/exchange-rates/${encodeURIComponent(date)}`, ExchangeRate, {
    method: "PATCH",
    body: { rate },
  });
}

/** Records a new BCV rate and refreshes both the list and the header rate. */
export function useRecordExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordExchangeRate,
    onSuccess: (result) => {
      if (result.ok) return queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });
}

/** Corrects an unfrozen BCV rate and refreshes both the list and the header rate. */
export function useCorrectExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: correctExchangeRate,
    onSuccess: (result) => {
      if (result.ok) return queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });
}
