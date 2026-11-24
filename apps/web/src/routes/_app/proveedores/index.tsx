import { SUPPLIER_ROLES } from "@cuadre/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useCreateSupplier, useSuppliers } from "@/api/suppliers";
import { PartnerListPage } from "@/features/partners/partner-list-page";
import { type PartnersSearch, partnersSearchSchema } from "@/features/partners/search";
import { suppliersMessages } from "@/messages";

export const Route = createFileRoute("/_app/proveedores/")({
  validateSearch: (search: Record<string, unknown>) => partnersSearchSchema.parse(search),
  component: SuppliersList,
});

function SuppliersList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const createSupplier = useCreateSupplier();

  const onNavigateSearch = useCallback(
    (updater: (previous: PartnersSearch) => PartnersSearch, options?: { replace?: boolean }) =>
      navigate({ search: updater, ...(options?.replace ? { replace: true } : {}) }),
    [navigate],
  );

  return (
    <PartnerListPage
      roles={SUPPLIER_ROLES}
      search={search}
      onNavigateSearch={onNavigateSearch}
      useList={useSuppliers}
      isCreating={createSupplier.isPending}
      onCreate={(request) => createSupplier.mutateAsync(request)}
      messages={suppliersMessages}
    />
  );
}
