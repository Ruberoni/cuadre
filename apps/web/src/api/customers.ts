import {
  type CreateCustomerRequest,
  Customer,
  type ListCustomersQuery,
  ListCustomersResponse,
} from "@cuadre/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, unwrapOrThrow } from "./client.ts";
import { partnerListPath } from "./partners.ts";

/** One page of the customer list. Keeps the previous page on screen while the next one loads. */
export function useCustomers(query: ListCustomersQuery, enabled = true) {
  return useQuery({
    queryKey: ["customers", query],
    queryFn: async () =>
      unwrapOrThrow(await apiRequest(partnerListPath("/customers", query), ListCustomersResponse)),
    placeholderData: keepPreviousData,
    enabled,
  });
}

function createCustomer(request: CreateCustomerRequest) {
  return apiRequest("/customers", Customer, { method: "POST", body: request });
}

/** Creates or promotes a customer and refreshes every cached list. Resolves to the `Result`, never throws. */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (result) => {
      if (result.ok) return queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
