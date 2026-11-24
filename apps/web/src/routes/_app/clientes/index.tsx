import { CUSTOMER_ROLES } from "@cuadre/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useCreateCustomer, useCustomers } from "@/api/customers";
import { PartnerListPage } from "@/features/partners/partner-list-page";
import { type PartnersSearch, partnersSearchSchema } from "@/features/partners/search";
import { customersMessages } from "@/messages";

export const Route = createFileRoute("/_app/clientes/")({
  validateSearch: (search: Record<string, unknown>) => partnersSearchSchema.parse(search),
  component: CustomersList,
});

function CustomersList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const createCustomer = useCreateCustomer();

  const onNavigateSearch = useCallback(
    (updater: (previous: PartnersSearch) => PartnersSearch, options?: { replace?: boolean }) =>
      navigate({ search: updater, ...(options?.replace ? { replace: true } : {}) }),
    [navigate],
  );

  return (
    <PartnerListPage
      roles={CUSTOMER_ROLES}
      search={search}
      onNavigateSearch={onNavigateSearch}
      useList={useCustomers}
      isCreating={createCustomer.isPending}
      onCreate={(request) => createCustomer.mutateAsync(request)}
      messages={customersMessages}
    />
  );
}
