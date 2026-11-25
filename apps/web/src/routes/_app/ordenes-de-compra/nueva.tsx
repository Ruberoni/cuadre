import { createFileRoute } from "@tanstack/react-router";
import { useCreatePurchaseOrder } from "@/api/purchase-orders";
import { usePageTitle } from "@/components/app-layout";
import { PurchaseOrderEditor } from "@/features/purchasing/purchase-order-editor";
import { purchaseOrdersMessages } from "@/messages";

export const Route = createFileRoute("/_app/ordenes-de-compra/nueva")({
  component: NewPurchaseOrderPage,
});

function NewPurchaseOrderPage() {
  usePageTitle(purchaseOrdersMessages.newPageTitle);
  const createOrder = useCreatePurchaseOrder();

  return (
    <PurchaseOrderEditor
      isSaving={createOrder.isPending}
      onSave={(body) => createOrder.mutateAsync(body)}
    />
  );
}
