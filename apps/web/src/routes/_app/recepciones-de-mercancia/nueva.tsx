import { createFileRoute } from "@tanstack/react-router";
import { useCreateGoodsReceipt } from "@/api/goods-receipts";
import { usePageTitle } from "@/components/app-layout";
import { GoodsReceiptEditor } from "@/features/purchasing/goods-receipt-editor";
import { newGoodsReceiptSearchSchema } from "@/features/purchasing/goods-receipts-search";
import { goodsReceiptsMessages } from "@/messages";

export const Route = createFileRoute("/_app/recepciones-de-mercancia/nueva")({
  validateSearch: newGoodsReceiptSearchSchema,
  component: NewGoodsReceiptPage,
});

function NewGoodsReceiptPage() {
  usePageTitle(goodsReceiptsMessages.newPageTitle);
  const { orden } = Route.useSearch();
  const createReceipt = useCreateGoodsReceipt();

  return (
    <GoodsReceiptEditor
      key={orden ?? "new"}
      initialPurchaseOrderId={orden}
      isSaving={createReceipt.isPending}
      onCreate={(body) => createReceipt.mutateAsync(body)}
    />
  );
}
