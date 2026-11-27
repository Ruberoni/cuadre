import {
  KARDEX_ROLES,
  PRODUCT_ROLES,
  PRODUCTS_PAGE_SIZE,
  type Product,
  type ProductSortField,
} from "@cuadre/contracts";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProducts } from "@/api/products";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { type Column, DataTable, Pager, type SortOrder } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productsSearchSchema } from "@/features/products/search";
import { formatMoney, formatQuantity } from "@/lib/format";
import {
  kardexMessages,
  productsMessages,
  taxRateColumnLabels,
  unitOfMeasureLabels,
} from "@/messages";

const SEARCH_DEBOUNCE_MS = 250;

export const Route = createFileRoute("/_app/productos/")({
  validateSearch: (search: Record<string, unknown>) => productsSearchSchema.parse(search),
  component: ProductsList,
});

function buildColumns(canViewKardex: boolean): readonly Column<Product, ProductSortField>[] {
  return [
    {
      id: "sku",
      header: productsMessages.columns.sku,
      sortKey: "sku",
      // Plain text until "Editar producto" exists (#36).
      cell: (product) => <span className="font-medium tabular-nums">{product.sku}</span>,
    },
    {
      id: "name",
      header: productsMessages.columns.name,
      sortKey: "name",
      cell: (product) => (
        <span className="block max-w-96 truncate" title={product.name}>
          {product.name}
        </span>
      ),
    },
    {
      id: "unitOfMeasure",
      header: productsMessages.columns.unitOfMeasure,
      cell: (product) => unitOfMeasureLabels[product.unitOfMeasure],
    },
    {
      id: "taxRate",
      header: productsMessages.columns.taxRate,
      align: "right",
      cell: (product) => taxRateColumnLabels[product.taxRate],
    },
    {
      id: "salePrice",
      header: productsMessages.columns.salePrice,
      align: "right",
      sortKey: "salePrice",
      cell: (product) => formatMoney(product.salePrice.minorUnits, product.salePrice.currency),
    },
    {
      id: "onHand",
      header: productsMessages.columns.onHand,
      align: "right",
      cell: (product) =>
        canViewKardex ? (
          <Link
            to="/kardex"
            search={{ producto: product.id, page: 1 }}
            aria-label={`${kardexMessages.viewKardexLabel(product.sku)}: ${formatQuantity(product.onHand)}`}
            className="inline-flex min-h-(--target-min) min-w-(--target-min) items-center justify-end font-medium text-primary tabular-nums underline-offset-4 hover:underline"
          >
            {formatQuantity(product.onHand)}
          </Link>
        ) : (
          <span className="tabular-nums">{formatQuantity(product.onHand)}</span>
        ),
    },
  ];
}

function ProductsList() {
  usePageTitle(productsMessages.pageTitle);
  const role = useSignedInUser().role;
  // Read-only roles see no way to create products (the API refuses them anyway).
  const canCreate = PRODUCT_ROLES.write.includes(role);
  const canViewKardex = KARDEX_ROLES.read.includes(role);
  const columns = useMemo(() => buildColumns(canViewKardex), [canViewKardex]);
  const { q, sort, order, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const products = useProducts({ q, sort, order, page });

  const [typed, setTyped] = useState(q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  // The last search this page put in the URL: a different `q` came from outside (sidebar link,
  // Back button) and replaces what is typed, instead of being undone by the debounce below.
  const navigatedQ = useRef(q);
  useEffect(() => {
    if (q === navigatedQ.current) return;
    navigatedQ.current = q;
    setTyped(q ?? "");
  }, [q]);
  // Search is server-side and debounced; a new search starts again at page 1.
  useEffect(() => {
    if (typed === (q ?? "")) return;
    const timer = setTimeout(() => {
      navigatedQ.current = typed === "" ? undefined : typed;
      void navigate({
        search: (previous) => ({ ...previous, q: typed === "" ? undefined : typed, page: 1 }),
        replace: true,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed, q, navigate]);

  const setSort = (key: ProductSortField) =>
    navigate({
      search: (previous) => ({
        ...previous,
        sort: key,
        order: previous.sort === key && previous.order === "asc" ? "desc" : "asc",
        page: 1,
      }),
    });
  const goToPage = (target: number) =>
    navigate({ search: (previous) => ({ ...previous, page: target }) });

  const clearSearch = () => {
    setTyped("");
    navigatedQ.current = undefined;
    void navigate({ search: (previous) => ({ ...previous, q: undefined, page: 1 }) });
    // The button that was clicked disappears with the empty state: keep the focus in the toolbar.
    searchRef.current?.focus();
  };

  const data = products.data;
  // Rows from a previous query (kept while the next one loads) say nothing about this one.
  const settled = data !== undefined && !products.isPlaceholderData;
  const searching = q !== undefined && q !== "";
  const noProductsAtAll = settled && data.total === 0 && !searching;

  // A page beyond the last one (hand-edited URL, or products removed) goes to the last page.
  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));
  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: (previous) => ({ ...previous, page: lastPage }), replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noProductsAtAll ? (
        <EmptyState
          title={productsMessages.empty.title}
          description={
            canCreate
              ? productsMessages.empty.description
              : productsMessages.empty.readOnlyDescription
          }
          action={canCreate ? <NewProductLink /> : undefined}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-(--search-width)">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchRef}
                type="search"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={productsMessages.searchPlaceholder}
                aria-label={productsMessages.searchPlaceholder}
                className="pl-9"
              />
            </div>
            {canCreate ? <NewProductLink /> : null}
          </div>

          {products.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{productsMessages.loadError}</span>
              <Button
                variant="outline"
                loading={products.isFetching}
                onClick={() => void products.refetch()}
              >
                {productsMessages.retry}
              </Button>
            </Alert>
          ) : settled && data.total === 0 ? (
            <EmptyState
              title={productsMessages.noResults.title(q ?? "")}
              description={productsMessages.noResults.description}
              action={
                <Button variant="link" onClick={clearSearch}>
                  {productsMessages.noResults.clear}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(product) => product.id}
                caption={productsMessages.tableCaption(
                  productsMessages.columns[sort satisfies ProductSortField],
                )}
                sort={sort}
                order={order satisfies SortOrder}
                onSort={(key) => void setSort(key)}
                loading={data === undefined}
                busy={products.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={productsMessages.pager(
                    (data.page - 1) * PRODUCTS_PAGE_SIZE + 1,
                    (data.page - 1) * PRODUCTS_PAGE_SIZE + data.items.length,
                    data.total,
                  )}
                  previousLabel={productsMessages.previousPage}
                  nextLabel={productsMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={products.isFetching}
                  onPrevious={() => void goToPage(data.page - 1)}
                  onNext={() => void goToPage(data.page + 1)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function NewProductLink() {
  return (
    <Button asChild>
      <Link to="/productos/nuevo">{productsMessages.newProduct}</Link>
    </Button>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border px-6 py-12 text-center">
      <p className="text-section-title">{title}</p>
      <p className="text-body text-muted-foreground">{description}</p>
      {action === undefined ? null : <div className="pt-2">{action}</div>}
    </div>
  );
}
