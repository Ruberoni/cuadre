import type {
  CreatePartnerRequest,
  ListPartnersQuery,
  ListPartnersResponse,
  Partner,
  PartnerSortField,
  Role,
} from "@cuadre/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiResult } from "@/api/client";
import { usePageTitle, useSignedInUser, useStatusAnnouncer } from "@/components/app-layout";
import { type Column, DataTable, Pager, type SortOrder } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatePartnerDialog, type PartnerDialogMessages } from "./create-partner-dialog";
import type { PartnersSearch } from "./search";

const SEARCH_DEBOUNCE_MS = 250;

export type PartnerListMessages = PartnerDialogMessages & {
  readonly pageTitle: string;
  readonly newPartner: string;
  readonly searchPlaceholder: string;
  readonly tableCaption: (sortedBy: string) => string;
  readonly columns: {
    readonly rif: string;
    readonly name: string;
    readonly phone: string;
    readonly email: string;
  };
  readonly emptyCell: string;
  readonly pager: (from: number, to: number, total: number) => string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly created: (rif: string) => string;
  readonly promoted: (rif: string) => string;
  readonly empty: {
    readonly title: string;
    readonly description: string;
  };
  readonly noResults: {
    readonly title: (query: string) => string;
    readonly description: string;
    readonly clear: string;
  };
  readonly loadError: string;
  readonly retry: string;
};

type NavigateSearch = (
  updater: (previous: PartnersSearch) => PartnersSearch,
  options?: { replace?: boolean },
) => Promise<void> | void;

export function PartnerListPage({
  roles,
  search,
  onNavigateSearch,
  useList,
  isCreating,
  onCreate,
  messages,
}: {
  roles: Readonly<Record<"read" | "write", readonly Role[]>>;
  search: PartnersSearch;
  onNavigateSearch: NavigateSearch;
  useList: (query: ListPartnersQuery, enabled: boolean) => UseQueryResult<ListPartnersResponse>;
  isCreating: boolean;
  onCreate: (request: CreatePartnerRequest) => Promise<ApiResult<Partner>>;
  messages: PartnerListMessages;
}) {
  usePageTitle(messages.pageTitle);
  const role = useSignedInUser().role;
  const canAccess = roles.read.includes(role);
  const canCreate = roles.write.includes(role);
  const { q, sort, order, page } = search;
  const announce = useStatusAnnouncer();
  const partners = useList({ q, sort, order, page }, canAccess);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState(q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigatedQ = useRef(q);

  const columns: readonly Column<Partner, PartnerSortField>[] = useMemo(
    () => [
      {
        id: "rif",
        header: messages.columns.rif,
        sortKey: "rif",
        cell: (partner) => <span className="font-medium tabular-nums">{partner.rif}</span>,
      },
      {
        id: "name",
        header: messages.columns.name,
        sortKey: "name",
        cell: (partner) => (
          <span className="block max-w-96 truncate" title={partner.name}>
            {partner.name}
          </span>
        ),
      },
      {
        id: "phone",
        header: messages.columns.phone,
        cell: (partner) => (
          <span className="tabular-nums">{partner.phone ?? messages.emptyCell}</span>
        ),
      },
      {
        id: "email",
        header: messages.columns.email,
        cell: (partner) => (
          <span className="block max-w-64 truncate" title={partner.email ?? undefined}>
            {partner.email ?? messages.emptyCell}
          </span>
        ),
      },
    ],
    [messages],
  );

  useEffect(() => {
    if (q === navigatedQ.current) return;
    navigatedQ.current = q;
    setTyped(q ?? "");
  }, [q]);

  useEffect(() => {
    if (!canAccess || typed === (q ?? "")) return;
    const timer = setTimeout(() => {
      navigatedQ.current = typed === "" ? undefined : typed;
      void onNavigateSearch(
        (previous) => ({ ...previous, q: typed === "" ? undefined : typed, page: 1 }),
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [canAccess, typed, q, onNavigateSearch]);

  const setSort = (key: PartnerSortField) =>
    onNavigateSearch((previous) => ({
      ...previous,
      sort: key,
      order: previous.sort === key && previous.order === "asc" ? "desc" : "asc",
      page: 1,
    }));

  const goToPage = (target: number) =>
    onNavigateSearch((previous) => ({ ...previous, page: target }));

  const clearSearch = () => {
    setTyped("");
    navigatedQ.current = undefined;
    void onNavigateSearch((previous) => ({ ...previous, q: undefined, page: 1 }));
    searchRef.current?.focus();
  };

  const data = partners.data;
  const settled = data !== undefined && !partners.isPlaceholderData;
  const searching = q !== undefined && q !== "";
  const noPartnersAtAll = settled && data.total === 0 && !searching;

  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));
  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void onNavigateSearch((previous) => ({ ...previous, page: lastPage }), { replace: true });
    }
  }, [settled, data, page, lastPage, onNavigateSearch]);

  if (!canAccess) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {messages.errors.FORBIDDEN}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noPartnersAtAll ? (
        <EmptyState
          title={messages.empty.title}
          description={messages.empty.description}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                {messages.newPartner}
              </Button>
            ) : undefined
          }
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
                placeholder={messages.searchPlaceholder}
                aria-label={messages.searchPlaceholder}
                className="pl-9"
              />
            </div>
            {canCreate ? (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                {messages.newPartner}
              </Button>
            ) : null}
          </div>

          {partners.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{messages.loadError}</span>
              <Button
                variant="outline"
                loading={partners.isFetching}
                onClick={() => void partners.refetch()}
              >
                {messages.retry}
              </Button>
            </Alert>
          ) : settled && data.total === 0 ? (
            <EmptyState
              title={messages.noResults.title(q ?? "")}
              description={messages.noResults.description}
              action={
                <Button variant="link" onClick={clearSearch}>
                  {messages.noResults.clear}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(partner) => partner.id}
                caption={messages.tableCaption(messages.columns[sort satisfies PartnerSortField])}
                sort={sort}
                order={order satisfies SortOrder}
                onSort={(key) => void setSort(key)}
                loading={data === undefined}
                busy={partners.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={messages.pager(
                    (data.page - 1) * data.pageSize + 1,
                    (data.page - 1) * data.pageSize + data.items.length,
                    data.total,
                  )}
                  previousLabel={messages.previousPage}
                  nextLabel={messages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={partners.isFetching}
                  onPrevious={() => void goToPage(data.page - 1)}
                  onNext={() => void goToPage(data.page + 1)}
                />
              )}
            </>
          )}
        </>
      )}

      <CreatePartnerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(rif, promoted) => {
          setDialogOpen(false);
          announce(promoted ? messages.promoted(rif) : messages.created(rif), {
            persistAcrossNextNavigation: false,
          });
        }}
        isPending={isCreating}
        onSubmitPartner={onCreate}
        messages={messages}
      />
    </div>
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
