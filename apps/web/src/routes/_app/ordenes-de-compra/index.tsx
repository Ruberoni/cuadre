import { PURCHASE_ORDER_ROLES, type PurchaseOrderSummary } from "@cuadre/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { usePurchaseOrders } from "@/api/purchase-orders";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { type Column, DataTable, Pager } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purchaseOrdersSearchSchema } from "@/features/purchasing/search";
import { formatDate, formatMoney } from "@/lib/format";
import { documentStatusLabels, purchaseOrdersMessages } from "@/messages";

export const Route = createFileRoute("/_app/ordenes-de-compra/")({
  validateSearch: purchaseOrdersSearchSchema,
  component: PurchaseOrdersListPage,
});

function PurchaseOrdersListPage() {
  usePageTitle(purchaseOrdersMessages.pageTitle);
  const role = useSignedInUser().role;
  const canRead = PURCHASE_ORDER_ROLES.read.includes(role);
  const canWrite = PURCHASE_ORDER_ROLES.write.includes(role);
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const orders = usePurchaseOrders({ page }, canRead);
  const data = orders.data;
  const settled = data !== undefined && !orders.isPlaceholderData;
  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));

  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: { page: lastPage }, replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  const columns: readonly Column<PurchaseOrderSummary>[] = useMemo(
    () => [
      {
        id: "documentDate",
        header: purchaseOrdersMessages.columns.documentDate,
        cell: (order) => (
          <Link
            to="/ordenes-de-compra/$id"
            params={{ id: order.id }}
            className="inline-flex min-h-(--target-min) items-center font-medium text-primary underline-offset-4 hover:underline tabular-nums"
          >
            {formatDate(order.documentDate)}
          </Link>
        ),
      },
      {
        id: "supplier",
        header: purchaseOrdersMessages.columns.supplier,
        cell: (order) => (
          <Link
            to="/ordenes-de-compra/$id"
            params={{ id: order.id }}
            className="block max-w-96 truncate hover:underline"
            title={order.supplier.name}
          >
            {order.supplier.name}
          </Link>
        ),
      },
      {
        id: "currency",
        header: purchaseOrdersMessages.columns.currency,
        cell: (order) => order.currency,
      },
      {
        id: "status",
        header: purchaseOrdersMessages.columns.status,
        cell: (order) => (
          <Badge variant={order.status === "ISSUED" ? "success" : "secondary"}>
            {documentStatusLabels[order.status]}
          </Badge>
        ),
      },
      {
        id: "total",
        header: purchaseOrdersMessages.columns.total,
        align: "right",
        cell: (order) => formatMoney(order.totals.total.minorUnits, order.totals.total.currency),
      },
    ],
    [],
  );

  if (!canRead) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {purchaseOrdersMessages.errors.FORBIDDEN_READ}
        </Alert>
      </div>
    );
  }

  const noOrdersAtAll = settled && data.total === 0;

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noOrdersAtAll ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border px-6 py-12 text-center">
          <p className="text-section-title">{purchaseOrdersMessages.empty.title}</p>
          <p className="text-body text-muted-foreground">
            {canWrite
              ? purchaseOrdersMessages.empty.description
              : purchaseOrdersMessages.empty.readOnlyDescription}
          </p>
          {canWrite ? (
            <div className="pt-2">
              <Button asChild>
                <Link to="/ordenes-de-compra/nueva">{purchaseOrdersMessages.newOrder}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {canWrite ? (
            <div className="flex justify-end">
              <Button asChild>
                <Link to="/ordenes-de-compra/nueva">{purchaseOrdersMessages.newOrder}</Link>
              </Button>
            </div>
          ) : null}

          {orders.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{purchaseOrdersMessages.loadError}</span>
              <Button
                variant="outline"
                loading={orders.isFetching}
                onClick={() => void orders.refetch()}
              >
                {purchaseOrdersMessages.retry}
              </Button>
            </Alert>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(order) => order.id}
                caption={purchaseOrdersMessages.tableCaption}
                loading={data === undefined}
                busy={orders.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={purchaseOrdersMessages.pager(
                    (data.page - 1) * data.pageSize + 1,
                    (data.page - 1) * data.pageSize + data.items.length,
                    data.total,
                  )}
                  previousLabel={purchaseOrdersMessages.previousPage}
                  nextLabel={purchaseOrdersMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={orders.isFetching}
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
