import { GOODS_RECEIPT_ROLES } from "@cuadre/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { ApiFailureError } from "@/api/client";
import {
  useDeleteGoodsReceipt,
  useGoodsReceipt,
  useIssueGoodsReceipt,
  useUpdateGoodsReceipt,
} from "@/api/goods-receipts";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoodsReceiptEditor } from "@/features/purchasing/goods-receipt-editor";
import { goodsReceiptsMessages } from "@/messages";

export const Route = createFileRoute("/_app/recepciones-de-mercancia/$id")({
  component: GoodsReceiptDetailPage,
});

function GoodsReceiptDetailPage() {
  usePageTitle(goodsReceiptsMessages.detailPageTitle);
  const { id } = Route.useParams();
  const role = useSignedInUser().role;
  const canRead = GOODS_RECEIPT_ROLES.read.includes(role);

  const receipt = useGoodsReceipt(id, canRead);
  const updateReceipt = useUpdateGoodsReceipt(id);
  const deleteReceipt = useDeleteGoodsReceipt();
  const issueReceipt = useIssueGoodsReceipt(id);

  if (!canRead) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {goodsReceiptsMessages.errors.FORBIDDEN_READ}
        </Alert>
      </div>
    );
  }

  if (receipt.isPending) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (receipt.isError || receipt.data === undefined) {
    const isNotFound =
      receipt.error instanceof ApiFailureError && receipt.error.failure.code === "NOT_FOUND";
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <span>
            {isNotFound ? goodsReceiptsMessages.notFound : goodsReceiptsMessages.detailLoadError}
          </span>
          {isNotFound ? null : (
            <Button
              variant="outline"
              loading={receipt.isFetching}
              onClick={() => void receipt.refetch()}
            >
              {goodsReceiptsMessages.retry}
            </Button>
          )}
        </Alert>
      </div>
    );
  }

  return (
    <GoodsReceiptEditor
      key={receipt.data.id}
      initialReceipt={receipt.data}
      isSaving={updateReceipt.isPending}
      isDeleting={deleteReceipt.isPending}
      isIssuing={issueReceipt.isPending}
      onUpdate={(body) => updateReceipt.mutateAsync(body)}
      onDelete={() => deleteReceipt.mutateAsync(id)}
      onIssue={() => issueReceipt.mutateAsync()}
    />
  );
}
