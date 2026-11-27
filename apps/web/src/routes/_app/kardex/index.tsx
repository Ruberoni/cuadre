import { KARDEX_PAGE_SIZE, KARDEX_ROLES, type KardexEntry, type Product } from "@cuadre/contracts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiFailureError } from "@/api/client";
import { useKardex } from "@/api/kardex";
import { useProducts } from "@/api/products";
import { usePageTitle, useSignedInUser } from "@/components/app-layout";
import { type Column, DataTable, Pager } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { kardexSearchSchema } from "@/features/kardex/search";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";
import { kardexMessages, unitOfMeasureLabels } from "@/messages";

const SEARCH_DEBOUNCE_MS = 200;

export const Route = createFileRoute("/_app/kardex/")({
  validateSearch: (search: Record<string, unknown>) => kardexSearchSchema.parse(search),
  component: KardexPage,
});

const columns: readonly Column<KardexEntry>[] = [
  {
    id: "documentDate",
    header: kardexMessages.columns.documentDate,
    cell: (entry) => <span className="tabular-nums">{formatDate(entry.documentDate)}</span>,
  },
  {
    id: "document",
    header: kardexMessages.columns.document,
    cell: (entry) => (
      <Link
        to="/recepciones-de-mercancia/$id"
        params={{ id: entry.referenceId }}
        className="inline-flex min-h-(--target-min) items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {kardexMessages.referenceDocument(entry.referenceType, entry.referenceNumber)}
      </Link>
    ),
  },
  {
    id: "inbound",
    header: kardexMessages.columns.inbound,
    align: "right",
    cell: (entry) => (
      <span className="tabular-nums">
        {entry.direction === "INBOUND" ? formatQuantity(entry.quantity) : kardexMessages.emptyCell}
      </span>
    ),
  },
  {
    id: "outbound",
    header: kardexMessages.columns.outbound,
    align: "right",
    cell: (entry) => (
      <span className="tabular-nums">
        {entry.direction === "OUTBOUND" ? formatQuantity(entry.quantity) : kardexMessages.emptyCell}
      </span>
    ),
  },
  {
    id: "unitCost",
    header: kardexMessages.columns.unitCost,
    align: "right",
    cell: (entry) => (
      <span className="tabular-nums">
        {formatMoney(entry.unitCost.minorUnits, entry.unitCost.currency)}
      </span>
    ),
  },
  {
    id: "averageCostAfter",
    header: kardexMessages.columns.averageCostAfter,
    align: "right",
    cell: (entry) => (
      <span className="tabular-nums">
        {entry.averageCostAfter === null
          ? kardexMessages.emptyCell
          : formatMoney(entry.averageCostAfter.minorUnits, entry.averageCostAfter.currency)}
      </span>
    ),
  },
  {
    id: "onHandAfter",
    header: kardexMessages.columns.onHandAfter,
    align: "right",
    cell: (entry) => (
      <span className="font-medium tabular-nums">{formatQuantity(entry.onHandAfter)}</span>
    ),
  },
];

function KardexPage() {
  usePageTitle(kardexMessages.pageTitle);
  const role = useSignedInUser().role;
  const canRead = KARDEX_ROLES.read.includes(role);
  const { producto, page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>(undefined);
  const selectorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (canRead) selectorRef.current?.focus();
  }, [canRead]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      setDebouncedSearch(trimmed === "" ? undefined : trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const productsQuery = useProducts(
    { q: debouncedSearch, sort: "sku", order: "asc", page: 1 },
    canRead,
  );
  const kardex = useKardex(producto, page, canRead);

  const productItems = productsQuery.data?.items ?? [];
  const selectedProductLabel = useMemo(() => {
    if (producto === undefined) return undefined;
    if (kardex.data?.product.id === producto) {
      return `${kardex.data.product.sku} — ${kardex.data.product.name}`;
    }
    const fromList = productItems.find((item) => item.id === producto);
    return fromList === undefined ? undefined : `${fromList.sku} — ${fromList.name}`;
  }, [producto, kardex.data, productItems]);

  const data = kardex.data;
  const settled = data !== undefined && !kardex.isPlaceholderData && data.product.id === producto;
  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));

  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: (previous) => ({ ...previous, page: lastPage }), replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  if (!canRead) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {kardexMessages.forbidden}
        </Alert>
      </div>
    );
  }

  const selectProduct = (product: Product) => {
    setOpen(false);
    setSearchInput("");
    void navigate({ search: { producto: product.id, page: 1 } });
  };

  const errorCode = kardex.error instanceof ApiFailureError ? kardex.error.failure.code : undefined;

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kardex-product-selector">{kardexMessages.productLabel}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={selectorRef}
              id="kardex-product-selector"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full max-w-md justify-between font-normal"
            >
              <span
                className={cn(
                  "truncate",
                  selectedProductLabel === undefined && "text-muted-foreground",
                )}
              >
                {selectedProductLabel ?? kardexMessages.productPlaceholder}
              </span>
              <ChevronsUpDownIcon
                aria-hidden="true"
                className="ml-2 size-4 shrink-0 text-muted-foreground"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            <Command shouldFilter={false}>
              <CommandInput
                value={searchInput}
                onValueChange={setSearchInput}
                placeholder={kardexMessages.productSearchPlaceholder}
              />
              <CommandList>
                {productsQuery.isPending ? (
                  <p className="py-6 text-center text-body text-muted-foreground">
                    {kardexMessages.productLoading}
                  </p>
                ) : productItems.length === 0 ? (
                  <CommandEmpty>{kardexMessages.productNoResults}</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {productItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => selectProduct(item)}
                      >
                        <CheckIcon
                          aria-hidden="true"
                          className={cn(
                            "size-4 shrink-0",
                            producto === item.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="font-medium tabular-nums">{item.sku}</span>
                        <span className="truncate text-muted-foreground">{item.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {producto === undefined ? (
        <EmptyState
          title={kardexMessages.emptySelection.title}
          description={kardexMessages.emptySelection.description}
        />
      ) : kardex.isError && data === undefined ? (
        errorCode === "NOT_FOUND" ? (
          <Alert variant="destructive" role="alert" className="block">
            {kardexMessages.notFound}
          </Alert>
        ) : errorCode === "FORBIDDEN" ? (
          <Alert variant="destructive" role="alert" className="block">
            {kardexMessages.forbidden}
          </Alert>
        ) : (
          <Alert variant="destructive" className="flex items-center justify-between gap-4">
            <span>{kardexMessages.loadError}</span>
            <Button
              variant="outline"
              loading={kardex.isFetching}
              onClick={() => void kardex.refetch()}
            >
              {kardexMessages.retry}
            </Button>
          </Alert>
        )
      ) : (
        <>
          {data === undefined ? null : (
            <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-md border border-border bg-card px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-muted-foreground">
                  {kardexMessages.summary.onHand}
                </dt>
                <dd className="text-section-title font-semibold tabular-nums">
                  {formatQuantity(data.onHand)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-muted-foreground">
                  {kardexMessages.summary.averageCost}
                </dt>
                <dd className="text-section-title font-semibold tabular-nums">
                  {data.averageCost === null
                    ? kardexMessages.summary.noAverageCost
                    : formatMoney(data.averageCost.minorUnits, data.averageCost.currency)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-caption text-muted-foreground">
                  {kardexMessages.summary.unitOfMeasure}
                </dt>
                <dd className="text-body font-medium">
                  {unitOfMeasureLabels[data.product.unitOfMeasure]}
                </dd>
              </div>
            </dl>
          )}

          {settled && data.total === 0 ? (
            <EmptyState
              title={kardexMessages.emptyMovements.title}
              description={kardexMessages.emptyMovements.description}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(entry) => entry.id}
                caption={kardexMessages.tableCaption(data?.product.name ?? "")}
                loading={data === undefined}
                busy={kardex.isFetching}
              />
              {data === undefined || data.total <= KARDEX_PAGE_SIZE ? null : (
                <Pager
                  summary={kardexMessages.pager(
                    (data.page - 1) * data.pageSize + 1,
                    (data.page - 1) * data.pageSize + data.items.length,
                    data.total,
                  )}
                  previousLabel={kardexMessages.previousPage}
                  nextLabel={kardexMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={kardex.isFetching}
                  onPrevious={() =>
                    void navigate({
                      search: (previous) => ({ ...previous, page: data.page - 1 }),
                    })
                  }
                  onNext={() =>
                    void navigate({
                      search: (previous) => ({ ...previous, page: data.page + 1 }),
                    })
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border px-6 py-12 text-center">
      <p className="text-section-title">{title}</p>
      <p className="text-body text-muted-foreground">{description}</p>
    </div>
  );
}
