import { PURCHASE_ORDER_ROLES } from "@cuadre/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { ApiFailureError } from "@/api/client";
import {
  useDeletePurchaseOrder,
  usePurchaseOrder,
  useUpdatePurchaseOrder,
} from "@/api/purchase-orders";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseOrderEditor } from "@/features/purchasing/purchase-order-editor";
import { purchaseOrdersMessages } from "@/messages";

export const Route = createFileRoute("/_app/ordenes-de-compra/$id")({
  component: PurchaseOrderDetailPage,
});

function PurchaseOrderDetailPage() {
  usePageTitle(purchaseOrdersMessages.detailPageTitle);
  const { id } = Route.useParams();
  const role = useSignedInUser().role;
  const canRead = PURCHASE_ORDER_ROLES.read.includes(role);

  const order = usePurchaseOrder(id, canRead);
  const updateOrder = useUpdatePurchaseOrder(id);
  const deleteOrder = useDeletePurchaseOrder();

  if (!canRead) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {purchaseOrdersMessages.errors.FORBIDDEN_READ}
        </Alert>
      </div>
    );
  }

  if (order.isPending) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (order.isError || order.data === undefined) {
    const isNotFound =
      order.error instanceof ApiFailureError && order.error.failure.code === "NOT_FOUND";
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <span>
            {isNotFound ? purchaseOrdersMessages.notFound : purchaseOrdersMessages.detailLoadError}
          </span>
          {isNotFound ? null : (
            <Button
              variant="outline"
              loading={order.isFetching}
              onClick={() => void order.refetch()}
            >
              {purchaseOrdersMessages.retry}
            </Button>
          )}
        </Alert>
      </div>
    );
  }

  return (
    <PurchaseOrderEditor
      key={order.data.id}
      initialOrder={order.data}
      isSaving={updateOrder.isPending}
      isDeleting={deleteOrder.isPending}
      onSave={(body) => updateOrder.mutateAsync(body)}
      onDelete={() => deleteOrder.mutateAsync(id)}
    />
  );
}
