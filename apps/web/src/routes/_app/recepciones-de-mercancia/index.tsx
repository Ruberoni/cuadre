import { GOODS_RECEIPT_ROLES, type GoodsReceiptSummary } from "@cuadre/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useGoodsReceipts } from "@/api/goods-receipts";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { type Column, DataTable, Pager } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { goodsReceiptsSearchSchema } from "@/features/purchasing/goods-receipts-search";
import { formatDate, formatMoney } from "@/lib/format";
import { documentStatusLabels, goodsReceiptsMessages } from "@/messages";

export const Route = createFileRoute("/_app/recepciones-de-mercancia/")({
  validateSearch: goodsReceiptsSearchSchema,
  component: GoodsReceiptsListPage,
});

function GoodsReceiptsListPage() {
  usePageTitle(goodsReceiptsMessages.pageTitle);
  const role = useSignedInUser().role;
  const canRead = GOODS_RECEIPT_ROLES.read.includes(role);
  const canWrite = GOODS_RECEIPT_ROLES.write.includes(role);
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const receipts = useGoodsReceipts({ page }, canRead);
  const data = receipts.data;
  const settled = data !== undefined && !receipts.isPlaceholderData;
  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));

  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: { page: lastPage }, replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  const columns: readonly Column<GoodsReceiptSummary>[] = useMemo(
    () => [
      {
        id: "documentDate",
        header: goodsReceiptsMessages.columns.documentDate,
        cell: (receipt) => (
          <Link
            to="/recepciones-de-mercancia/$id"
            params={{ id: receipt.id }}
            className="inline-flex min-h-(--target-min) items-center font-medium text-primary underline-offset-4 hover:underline tabular-nums"
          >
            {formatDate(receipt.documentDate)}
          </Link>
        ),
      },
      {
        id: "supplier",
        header: goodsReceiptsMessages.columns.supplier,
        cell: (receipt) => (
          <Link
            to="/recepciones-de-mercancia/$id"
            params={{ id: receipt.id }}
            className="block max-w-80 truncate hover:underline"
            title={receipt.supplier.name}
          >
            {receipt.supplier.name}
          </Link>
        ),
      },
      {
        id: "supplierInvoiceNumber",
        header: goodsReceiptsMessages.columns.supplierInvoiceNumber,
        cell: (receipt) => <span className="tabular-nums">{receipt.supplierInvoiceNumber}</span>,
      },
      {
        id: "currency",
        header: goodsReceiptsMessages.columns.currency,
        cell: (receipt) => receipt.currency,
      },
      {
        id: "status",
        header: goodsReceiptsMessages.columns.status,
        cell: (receipt) => (
          <Badge variant={receipt.status === "ISSUED" ? "success" : "secondary"}>
            {documentStatusLabels[receipt.status]}
          </Badge>
        ),
      },
      {
        id: "total",
        header: goodsReceiptsMessages.columns.total,
        align: "right",
        cell: (receipt) =>
          formatMoney(receipt.totals.total.minorUnits, receipt.totals.total.currency),
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {goodsReceiptsMessages.errors.FORBIDDEN_READ}
        </Alert>
      </div>
    );
  }

  const noReceiptsAtAll = settled && data.total === 0;

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noReceiptsAtAll ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border px-6 py-12 text-center">
          <p className="text-section-title">{goodsReceiptsMessages.empty.title}</p>
          <p className="text-body text-muted-foreground">
            {canWrite
              ? goodsReceiptsMessages.empty.description
              : goodsReceiptsMessages.empty.readOnlyDescription}
          </p>
          {canWrite ? (
            <div className="pt-2">
              <Button asChild>
                <Link to="/recepciones-de-mercancia/nueva" search={{}}>
                  {goodsReceiptsMessages.newReceipt}
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {canWrite ? (
            <div className="flex justify-end">
              <Button asChild>
                <Link to="/recepciones-de-mercancia/nueva" search={{}}>
                  {goodsReceiptsMessages.newReceipt}
                </Link>
              </Button>
            </div>
          ) : null}

          {receipts.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{goodsReceiptsMessages.loadError}</span>
              <Button
                variant="outline"
                loading={receipts.isFetching}
                onClick={() => void receipts.refetch()}
              >
                {goodsReceiptsMessages.retry}
              </Button>
            </Alert>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(receipt) => receipt.id}
                caption={goodsReceiptsMessages.tableCaption}
                loading={data === undefined}
                busy={receipts.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={goodsReceiptsMessages.pager(
                    (data.page - 1) * data.pageSize + 1,
                    (data.page - 1) * data.pageSize + data.items.length,
                    data.total,
                  )}
                  previousLabel={goodsReceiptsMessages.previousPage}
                  nextLabel={goodsReceiptsMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={receipts.isFetching}
                  onPrevious={() => void navigate({ search: { page: data.page - 1 } })}
                  onNext={() => void navigate({ search: { page: data.page + 1 } })}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
