import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_NAME_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
  SUPPLIER_FIELDS,
  SUPPLIER_ROLES,
  type Supplier,
  type SupplierSortField,
} from "@cuadre/contracts";
import { parseRif } from "@cuadre/shared-kernel";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateSupplier, useSuppliers } from "@/api/suppliers";
import { usePageTitle, useSignedInUser, useStatusAnnouncer } from "@/components/app-layout";
import { type Column, DataTable, Pager, type SortOrder } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { suppliersSearchSchema } from "@/features/suppliers/search";
import {
  errorMessages,
  supplierFieldMessage,
  supplierFieldMessages,
  suppliersMessages,
} from "@/messages";

const SEARCH_DEBOUNCE_MS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/_app/proveedores/")({
  validateSearch: (search: Record<string, unknown>) => suppliersSearchSchema.parse(search),
  component: SuppliersList,
});

const columns: readonly Column<Supplier, SupplierSortField>[] = [
  {
    id: "rif",
    header: suppliersMessages.columns.rif,
    sortKey: "rif",
    cell: (supplier) => <span className="font-medium tabular-nums">{supplier.rif}</span>,
  },
  {
    id: "name",
    header: suppliersMessages.columns.name,
    sortKey: "name",
    cell: (supplier) => (
      <span className="block max-w-96 truncate" title={supplier.name}>
        {supplier.name}
      </span>
    ),
  },
  {
    id: "phone",
    header: suppliersMessages.columns.phone,
    cell: (supplier) => (
      <span className="tabular-nums">{supplier.phone ?? suppliersMessages.emptyCell}</span>
    ),
  },
  {
    id: "email",
    header: suppliersMessages.columns.email,
    cell: (supplier) => (
      <span className="block max-w-64 truncate" title={supplier.email ?? undefined}>
        {supplier.email ?? suppliersMessages.emptyCell}
      </span>
    ),
  },
];

function SuppliersList() {
  usePageTitle(suppliersMessages.pageTitle);
  const role = useSignedInUser().role;
  const canAccess = SUPPLIER_ROLES.read.includes(role);
  const canCreate = SUPPLIER_ROLES.write.includes(role);
  const { q, sort, order, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const announce = useStatusAnnouncer();
  const suppliers = useSuppliers({ q, sort, order, page }, canAccess);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState(q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigatedQ = useRef(q);

  useEffect(() => {
    if (q === navigatedQ.current) return;
    navigatedQ.current = q;
    setTyped(q ?? "");
  }, [q]);

  useEffect(() => {
    if (!canAccess || typed === (q ?? "")) return;
    const timer = setTimeout(() => {
      navigatedQ.current = typed === "" ? undefined : typed;
      void navigate({
        search: (previous) => ({ ...previous, q: typed === "" ? undefined : typed, page: 1 }),
        replace: true,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [canAccess, typed, q, navigate]);

  const setSort = (key: SupplierSortField) =>
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
    searchRef.current?.focus();
  };

  const data = suppliers.data;
  const settled = data !== undefined && !suppliers.isPlaceholderData;
  const searching = q !== undefined && q !== "";
  const noSuppliersAtAll = settled && data.total === 0 && !searching;

  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));
  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: (previous) => ({ ...previous, page: lastPage }), replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  if (!canAccess) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {suppliersMessages.errors.FORBIDDEN}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noSuppliersAtAll ? (
        <EmptyState
          title={suppliersMessages.empty.title}
          description={suppliersMessages.empty.description}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                {suppliersMessages.newSupplier}
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
                placeholder={suppliersMessages.searchPlaceholder}
                aria-label={suppliersMessages.searchPlaceholder}
                className="pl-9"
              />
            </div>
            {canCreate ? (
              <Button type="button" onClick={() => setDialogOpen(true)}>
                {suppliersMessages.newSupplier}
              </Button>
            ) : null}
          </div>

          {suppliers.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{suppliersMessages.loadError}</span>
              <Button
                variant="outline"
                loading={suppliers.isFetching}
                onClick={() => void suppliers.refetch()}
              >
                {suppliersMessages.retry}
              </Button>
            </Alert>
          ) : settled && data.total === 0 ? (
            <EmptyState
              title={suppliersMessages.noResults.title(q ?? "")}
              description={suppliersMessages.noResults.description}
              action={
                <Button variant="link" onClick={clearSearch}>
                  {suppliersMessages.noResults.clear}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(supplier) => supplier.id}
                caption={suppliersMessages.tableCaption(
                  suppliersMessages.columns[sort satisfies SupplierSortField],
                )}
                sort={sort}
                order={order satisfies SortOrder}
                onSort={(key) => void setSort(key)}
                loading={data === undefined}
                busy={suppliers.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={suppliersMessages.pager(
                    (data.page - 1) * data.pageSize + 1,
                    (data.page - 1) * data.pageSize + data.items.length,
                    data.total,
                  )}
                  previousLabel={suppliersMessages.previousPage}
                  nextLabel={suppliersMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={suppliers.isFetching}
                  onPrevious={() => void goToPage(data.page - 1)}
                  onNext={() => void goToPage(data.page + 1)}
                />
              )}
            </>
          )}
        </>
      )}

      <CreateSupplierDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(rif) => {
          setDialogOpen(false);
          announce(suppliersMessages.created(rif), { persistAcrossNextNavigation: false });
        }}
      />
    </div>
  );
}

const formSchema = z.object({
  rif: z.string().superRefine((text, context) => {
    const parsed = parseRif(text);
    if (!parsed.ok) {
      context.addIssue({
        code: "custom",
        message: supplierFieldMessages.rif[parsed.error] ?? "",
      });
    }
  }),
  name: z
    .string()
    .trim()
    .min(1, supplierFieldMessages.name.REQUIRED)
    .max(PARTNER_NAME_MAX_LENGTH, supplierFieldMessages.name.TOO_LONG),
  phone: z.string().trim().max(PARTNER_PHONE_MAX_LENGTH, supplierFieldMessages.phone.TOO_LONG),
  email: z.string().superRefine((text, context) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    if (trimmed.length > PARTNER_EMAIL_MAX_LENGTH) {
      context.addIssue({ code: "custom", message: supplierFieldMessages.email.TOO_LONG ?? "" });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      context.addIssue({
        code: "custom",
        message: supplierFieldMessages.email.INVALID_FORMAT ?? "",
      });
    }
  }),
  address: z
    .string()
    .trim()
    .max(PARTNER_ADDRESS_MAX_LENGTH, supplierFieldMessages.address.TOO_LONG),
});
type FormValues = z.infer<typeof formSchema>;

const isFieldName = (name: string): name is keyof FormValues =>
  (SUPPLIER_FIELDS as readonly string[]).includes(name);

function CreateSupplierDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (rif: string) => void;
}) {
  const createSupplier = useCreateSupplier();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const alertRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { rif: "", name: "", phone: "", email: "", address: "" },
  });
  const { reset, setFocus } = form;

  useEffect(() => {
    if (!open) return;
    setFormError(undefined);
    reset({ rif: "", name: "", phone: "", email: "", address: "" });
  }, [open, reset]);

  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  async function onSubmit(values: FormValues) {
    setFormError(undefined);
    const result = await createSupplier.mutateAsync({
      rif: values.rif,
      name: values.name,
      phone: values.phone.trim() === "" ? null : values.phone.trim(),
      email: values.email.trim() === "" ? null : values.email.trim(),
      address: values.address.trim() === "" ? null : values.address.trim(),
    });

    if (result.ok) {
      onCreated(result.value.rif);
      return;
    }

    const failure = result.error;
    if (failure.code === "UNAUTHORIZED") return;
    if (failure.code === "RIF_ALREADY_EXISTS") {
      form.setError(
        "rif",
        {
          message: errorMessages.RIF_ALREADY_EXISTS({
            ...(failure.rif ? { rif: failure.rif } : {}),
          }),
        },
        { shouldFocus: true },
      );
      return;
    }
    if (failure.code === "VALIDATION_ERROR") {
      let focused = false;
      for (const issue of failure.issues ?? []) {
        const message = supplierFieldMessage(issue.field, issue.code);
        if (message === undefined || !isFieldName(issue.field)) continue;
        form.setError(issue.field, { message }, { shouldFocus: !focused });
        focused = true;
      }
      if (focused) return;
    }
    if (failure.code === "FORBIDDEN") {
      setFormError(suppliersMessages.errors.FORBIDDEN);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(suppliersMessages.errors.saveFailed);
      return;
    }
    setFormError(errorMessages[failure.code]({}));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          setFocus("rif");
        }}
      >
        <DialogHeader>
          <DialogTitle>{suppliersMessages.form.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="rif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{suppliersMessages.form.rif}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={suppliersMessages.form.rifPlaceholder}
                      autoComplete="off"
                      aria-required="true"
                    />
                  </FormControl>
                  <FormDescription>{suppliersMessages.form.rifHelp}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{suppliersMessages.form.name}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" aria-required="true" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{suppliersMessages.form.phone}</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{suppliersMessages.form.email}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={suppliersMessages.form.emailPlaceholder}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{suppliersMessages.form.address}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError === undefined ? null : (
              <Alert
                ref={alertRef}
                variant="destructive"
                role="alert"
                tabIndex={-1}
                className="block"
              >
                {formError}
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {suppliersMessages.form.cancel}
              </Button>
              <Button type="submit" loading={createSupplier.isPending}>
                {createSupplier.isPending
                  ? suppliersMessages.form.submitting
                  : suppliersMessages.form.submit}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
