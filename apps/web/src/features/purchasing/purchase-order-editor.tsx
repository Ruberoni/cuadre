import {
  type FieldIssue,
  GOODS_RECEIPT_ROLES,
  type Product,
  PURCHASE_ORDER_ROLES,
  type PurchaseOrder,
  type SavePurchaseOrderRequest,
  UNIT_ALLOWS_DECIMALS,
} from "@cuadre/contracts";
import {
  type Currency,
  computeDocumentTotals,
  type money,
  parseQuantity,
} from "@cuadre/shared-kernel";
import { Link, useNavigate } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiResult } from "@/api/client";
import { useProducts } from "@/api/products";
import { useSuppliers } from "@/api/suppliers";
import { useSignedInUser, useStatusAnnouncer } from "@/components/app-layout";
import { MoneyInput, toMoney } from "@/components/money-input";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { defaultPurchaseOrdersSearch } from "@/features/purchasing/search";
import { TotalsCard } from "@/features/purchasing/totals-card";
import {
  formatAmount,
  formatDate,
  formatMoney,
  formatQuantity,
  parseDate,
  parseQuantityInput,
  todayCaracas,
} from "@/lib/format";
import {
  documentStatusLabels,
  errorMessages,
  goodsReceiptsMessages,
  priceParseMessages,
  purchaseOrderFieldMessage,
  purchaseOrderFieldMessages,
  purchaseOrdersMessages,
  taxRateColumnLabels,
  unitOfMeasureLabels,
} from "@/messages";

type DraftLineState = {
  readonly key: string;
  productId: string;
  quantity: string;
  unitCost: string;
};

type FieldErrors = Record<string, string>;

let nextLineKey = 1;
function makeLineKey(): string {
  nextLineKey += 1;
  return `line-${nextLineKey}`;
}

export function PurchaseOrderEditor({
  initialOrder,
  isSaving,
  isDeleting,
  isIssuing,
  onSave,
  onDelete,
  onIssue,
}: {
  initialOrder?: PurchaseOrder;
  isSaving: boolean;
  isDeleting?: boolean;
  isIssuing?: boolean;
  onSave: (body: SavePurchaseOrderRequest) => Promise<ApiResult<PurchaseOrder>>;
  onDelete?: () => Promise<ApiResult<undefined>>;
  onIssue?: () => Promise<ApiResult<PurchaseOrder>>;
}) {
  const role = useSignedInUser().role;
  const canWrite = PURCHASE_ORDER_ROLES.write.includes(role);
  const navigate = useNavigate();
  const announce = useStatusAnnouncer();

  // Read-only views (warehouse role or issued POs) must NOT query `/api/suppliers` or `/api/products`.
  const canEdit = canWrite && initialOrder?.status !== "ISSUED";
  const suppliersQuery = useSuppliers({ sort: "name", order: "asc", page: 1 }, canEdit);
  const productsQuery = useProducts({ sort: "sku", order: "asc", page: 1 }, canEdit);

  const suppliers = suppliersQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const productsById = useMemo(
    () => new Map<string, Product>(products.map((p) => [p.id, p])),
    [products],
  );

  const [supplierId, setSupplierId] = useState(initialOrder?.supplier.id ?? "");
  const [currency, setCurrency] = useState<Currency>(initialOrder?.currency ?? "USD");
  const [documentDate, setDocumentDate] = useState(
    formatDate(initialOrder?.documentDate ?? todayCaracas()),
  );
  const [lines, setLines] = useState<DraftLineState[]>(() =>
    (initialOrder?.lines ?? []).map((line) => ({
      key: line.id,
      productId: line.productId,
      quantity: formatQuantity(line.quantity),
      unitCost: formatAmount(line.unitCost.minorUnits),
    })),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const isDirty = useMemo(() => {
    if (initialOrder === undefined) return false;
    if (supplierId !== initialOrder.supplier.id) return true;
    if (currency !== initialOrder.currency) return true;
    if (documentDate !== formatDate(initialOrder.documentDate)) return true;
    if (lines.length !== initialOrder.lines.length) return true;
    return lines.some((line, index) => {
      const orig = initialOrder.lines[index];
      if (orig === undefined) return true;
      return (
        line.productId !== orig.productId ||
        line.quantity !== formatQuantity(orig.quantity) ||
        line.unitCost !== formatAmount(orig.unitCost.minorUnits)
      );
    });
  }, [initialOrder, supplierId, currency, documentDate, lines]);

  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  const liveTotals = useMemo(() => {
    const validLines: {
      quantity: NonNullable<
        ReturnType<typeof parseQuantity> extends infer R
          ? R extends { ok: true; value: infer V }
            ? V
            : never
          : never
      >;
      unitPrice: NonNullable<
        ReturnType<typeof money> extends infer R
          ? R extends { ok: true; value: infer V }
            ? V
            : never
          : never
      >;
      taxRate: Product["taxRate"];
    }[] = [];
    const lineTotalsByKey = new Map<string, number>();

    for (const line of lines) {
      const product = productsById.get(line.productId);
      if (product === undefined) continue;
      const qtyCanonical = parseQuantityInput(line.quantity, {
        allowDecimals: UNIT_ALLOWS_DECIMALS[product.unitOfMeasure],
      });
      const cost = toMoney(line.unitCost, currency);
      if (!qtyCanonical.ok || !cost.ok || cost.value.minorUnits <= 0) continue;
      const qty = parseQuantity(qtyCanonical.value, {
        allowDecimals: UNIT_ALLOWS_DECIMALS[product.unitOfMeasure],
      });
      if (!qty.ok) continue;

      const single = computeDocumentTotals(
        [{ quantity: qty.value, unitPrice: cost.value, taxRate: product.taxRate }],
        currency,
      );
      if (single.ok && single.value.lineTotals[0] !== undefined) {
        lineTotalsByKey.set(line.key, single.value.lineTotals[0].minorUnits);
      }
      validLines.push({ quantity: qty.value, unitPrice: cost.value, taxRate: product.taxRate });
    }

    const totals = computeDocumentTotals(validLines, currency);
    return {
      lineTotalsByKey,
      totals: totals.ok ? totals.value : undefined,
    };
  }, [lines, productsById, currency]);

  if (!canWrite && initialOrder === undefined) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {purchaseOrdersMessages.errors.FORBIDDEN_WRITE}
        </Alert>
      </div>
    );
  }

  if (initialOrder !== undefined && (initialOrder.status === "ISSUED" || !canWrite)) {
    return <ReadOnlyPurchaseOrder order={initialOrder} />;
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: makeLineKey(), productId: "", quantity: "1", unitCost: "" },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      const next: FieldErrors = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith("lines.")) next[k] = v;
      }
      return next;
    });
  }

  function updateLine(index: number, patch: Partial<DraftLineState>) {
    setLines((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function applyValidationIssues(issues: readonly FieldIssue[]): boolean {
    const serverErrors: FieldErrors = {};
    let linesError: string | undefined;
    for (const issue of issues) {
      const msg = purchaseOrderFieldMessage(issue.field, issue.code);
      if (msg === undefined) continue;
      if (issue.field === "lines") {
        linesError = msg;
      } else {
        serverErrors[issue.field] = msg;
      }
    }
    if (Object.keys(serverErrors).length === 0 && linesError === undefined) return false;
    setFieldErrors(serverErrors);
    if (linesError !== undefined) setFormError(linesError);
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const errors: FieldErrors = {};
    if (supplierId.trim() === "") {
      errors.supplierId = purchaseOrderFieldMessages.supplierId.REQUIRED ?? "";
    }

    let isoDate = "";
    if (documentDate.trim() === "") {
      errors.documentDate = purchaseOrderFieldMessages.documentDate.REQUIRED ?? "";
    } else {
      const parsedDate = parseDate(documentDate);
      if (!parsedDate.ok) {
        errors.documentDate = purchaseOrderFieldMessages.documentDate.INVALID_DATE ?? "";
      } else if (parsedDate.value > todayCaracas()) {
        errors.documentDate = purchaseOrderFieldMessages.documentDate.DOCUMENT_DATE_IN_FUTURE ?? "";
      } else {
        isoDate = parsedDate.value;
      }
    }

    const requestLines: SavePurchaseOrderRequest["lines"] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const product = productsById.get(line.productId);
      if (line.productId === "" || product === undefined) {
        errors[`lines.${i}.productId`] = purchaseOrderFieldMessages.productId.REQUIRED ?? "";
      }

      const allowDecimals =
        product === undefined ? true : UNIT_ALLOWS_DECIMALS[product.unitOfMeasure];
      const parsedQty = parseQuantityInput(line.quantity, { allowDecimals });
      if (!parsedQty.ok) {
        errors[`lines.${i}.quantity`] =
          purchaseOrderFieldMessages.quantity[parsedQty.error] ??
          purchaseOrderFieldMessages.quantity.INVALID_FORMAT ??
          "";
      }

      let costMinor = 0;
      if (line.unitCost.trim() === "") {
        errors[`lines.${i}.unitCost`] = purchaseOrderFieldMessages.unitCost.REQUIRED ?? "";
      } else {
        const parsedCost = toMoney(line.unitCost, currency);
        if (!parsedCost.ok) {
          errors[`lines.${i}.unitCost`] = priceParseMessages[parsedCost.error];
        } else if (parsedCost.value.minorUnits <= 0) {
          errors[`lines.${i}.unitCost`] = purchaseOrderFieldMessages.unitCost.NOT_POSITIVE ?? "";
        } else {
          costMinor = parsedCost.value.minorUnits;
        }
      }

      if (product !== undefined && parsedQty.ok && costMinor > 0) {
        requestLines.push({
          productId: product.id,
          quantity: parsedQty.value,
          unitCost: { minorUnits: costMinor, currency },
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const result = await onSave({
      supplierId,
      currency,
      documentDate: isoDate,
      lines: requestLines,
    });

    if (result.ok) {
      announce(purchaseOrdersMessages.saved);
      await navigate({ to: "/ordenes-de-compra", search: defaultPurchaseOrdersSearch });
      return;
    }

    const failure = result.error;
    if (failure.code === "UNAUTHORIZED") return;
    if (
      failure.code === "VALIDATION_ERROR" &&
      failure.issues !== undefined &&
      applyValidationIssues(failure.issues)
    ) {
      return;
    }
    if (failure.code === "FORBIDDEN") {
      setFormError(purchaseOrdersMessages.errors.FORBIDDEN_WRITE);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(purchaseOrdersMessages.errors.saveFailed);
      return;
    }
    setFormError(errorMessages[failure.code]({}));
  }

  async function handleConfirmDelete() {
    if (onDelete === undefined) return;
    setFormError(undefined);
    const result = await onDelete();
    setDeleteDialogOpen(false);
    if (result.ok) {
      announce(purchaseOrdersMessages.deleted);
      await navigate({ to: "/ordenes-de-compra", search: defaultPurchaseOrdersSearch });
      return;
    }
    if (result.error.code === "UNAUTHORIZED") return;
    if (result.error.code === "DOCUMENT_NOT_DRAFT") {
      setFormError(errorMessages.DOCUMENT_NOT_DRAFT({}));
      return;
    }
    setFormError(purchaseOrdersMessages.errors.deleteFailed);
  }

  async function handleConfirmIssue() {
    if (onIssue === undefined) return;
    setFormError(undefined);
    setFieldErrors({});
    const result = await onIssue();
    setIssueDialogOpen(false);
    if (result.ok) {
      announce(purchaseOrdersMessages.issued);
      return;
    }
    const failure = result.error;
    if (failure.code === "UNAUTHORIZED") return;
    if (
      failure.code === "VALIDATION_ERROR" &&
      failure.issues !== undefined &&
      applyValidationIssues(failure.issues)
    ) {
      return;
    }
    if (failure.code === "FORBIDDEN") {
      setFormError(purchaseOrdersMessages.errors.FORBIDDEN_WRITE);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(purchaseOrdersMessages.errors.issueFailed);
      return;
    }
    setFormError(
      errorMessages[failure.code]({
        ...(failure.date === undefined ? {} : { date: failure.date }),
      }),
    );
  }

  const m = purchaseOrdersMessages.form;

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-6"
    >
      {initialOrder === undefined ? null : (
        <div className="flex items-center gap-2">
          <Badge variant={initialOrder.status === "ISSUED" ? "success" : "secondary"}>
            {documentStatusLabels[initialOrder.status]}
          </Badge>
        </div>
      )}

      <div className="grid max-w-3xl grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-supplier">{m.supplier}</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger
              id="po-supplier"
              aria-required="true"
              aria-invalid={fieldErrors.supplierId !== undefined}
              className="w-full"
            >
              <SelectValue placeholder={m.supplierPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.rif})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.supplierId === undefined ? null : (
            <p className="text-caption text-destructive">{fieldErrors.supplierId}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-currency">{m.currency}</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger id="po-currency" aria-required="true" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">{m.currencies.USD}</SelectItem>
              <SelectItem value="VES">{m.currencies.VES}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-date">{m.documentDate}</Label>
          <Input
            id="po-date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            placeholder={m.documentDatePlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-invalid={fieldErrors.documentDate !== undefined}
          />
          {fieldErrors.documentDate === undefined ? (
            <p className="text-caption text-muted-foreground">{m.documentDateHelp}</p>
          ) : (
            <p className="text-caption text-destructive">{fieldErrors.documentDate}</p>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-section-title">{m.linesHeading}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <PlusIcon aria-hidden="true" className="size-4" />
            {m.addLine}
          </Button>
        </div>

        {lines.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-6 text-center text-body text-muted-foreground">
            {m.noLines}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted">
                  <TableHead>{m.product}</TableHead>
                  <TableHead className="w-36 text-right">{m.quantity}</TableHead>
                  <TableHead className="w-44 text-right">{m.unitCost}</TableHead>
                  <TableHead className="w-24">{m.iva}</TableHead>
                  <TableHead className="w-36 text-right">{m.lineSubtotal}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{m.removeLine}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => {
                  const product = productsById.get(line.productId);
                  const lineSubtotal = liveTotals.lineTotalsByKey.get(line.key);
                  const productErr = fieldErrors[`lines.${index}.productId`];
                  const qtyErr = fieldErrors[`lines.${index}.quantity`];
                  const costErr = fieldErrors[`lines.${index}.unitCost`];

                  return (
                    <TableRow key={line.key}>
                      <TableCell className="align-top">
                        <Select
                          value={line.productId}
                          onValueChange={(value) => updateLine(index, { productId: value })}
                        >
                          <SelectTrigger
                            aria-label={`${m.product} ${index + 1}`}
                            aria-invalid={productErr !== undefined}
                            className="w-full"
                          >
                            <SelectValue placeholder={m.productPlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.sku} — {p.name} ({unitOfMeasureLabels[p.unitOfMeasure]})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {productErr === undefined ? null : (
                          <p className="mt-1 text-caption text-destructive">{productErr}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          aria-label={`${m.quantity} ${index + 1}`}
                          aria-invalid={qtyErr !== undefined}
                          inputMode="decimal"
                          autoComplete="off"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, {
                              quantity: e.target.value.replace(/[^\d.,]/g, ""),
                            })
                          }
                          className="text-right tabular-nums"
                        />
                        {qtyErr === undefined ? null : (
                          <p className="mt-1 text-right text-caption text-destructive">{qtyErr}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <MoneyInput
                          aria-label={`${m.unitCost} ${index + 1}`}
                          aria-invalid={costErr !== undefined}
                          currency={currency}
                          value={line.unitCost}
                          onChange={(value) => updateLine(index, { unitCost: value })}
                          className="text-right"
                        />
                        {costErr === undefined ? null : (
                          <p className="mt-1 text-right text-caption text-destructive">{costErr}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top pt-3 text-table text-muted-foreground">
                        {product === undefined ? "—" : taxRateColumnLabels[product.taxRate]}
                      </TableCell>
                      <TableCell className="align-top pt-3 text-right font-medium tabular-nums">
                        {lineSubtotal === undefined ? "—" : formatMoney(lineSubtotal, currency)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${m.removeLine} ${index + 1}`}
                          onClick={() => removeLine(index)}
                        >
                          <Trash2Icon aria-hidden="true" className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <TotalsCard
        currency={currency}
        subtotal={liveTotals.totals?.subtotal.minorUnits ?? 0}
        ivaGeneral={liveTotals.totals?.ivaByRate.general.minorUnits ?? 0}
        ivaReduced={liveTotals.totals?.ivaByRate.reduced.minorUnits ?? 0}
        total={liveTotals.totals?.total.minorUnits ?? 0}
      />

      {formError === undefined ? null : (
        <Alert ref={alertRef} variant="destructive" role="alert" tabIndex={-1} className="block">
          {formError}
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              type="submit"
              variant={onIssue !== undefined && !isDirty ? "outline" : "default"}
              loading={isSaving}
              disabled={isDeleting || isIssuing}
            >
              {isSaving ? m.submitting : m.submit}
            </Button>
            {onIssue === undefined ? null : (
              <Button
                type="button"
                variant={!isDirty ? "default" : "outline"}
                loading={isIssuing ?? false}
                disabled={isDirty || isSaving || isDeleting}
                aria-describedby={isDirty ? "po-issue-dirty-hint" : undefined}
                onClick={() => setIssueDialogOpen(true)}
              >
                {isIssuing ? m.issuing : m.issue}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/ordenes-de-compra" search={defaultPurchaseOrdersSearch}>
                {m.cancel}
              </Link>
            </Button>
          </div>

          {onDelete === undefined ? null : (
            <Button
              type="button"
              variant="destructive"
              loading={isDeleting ?? false}
              disabled={isSaving || isIssuing}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {isDeleting ? m.deleting : m.delete}
            </Button>
          )}
        </div>
        {onIssue !== undefined && isDirty ? (
          <p id="po-issue-dirty-hint" className="text-caption text-muted-foreground">
            {m.issueDirtyHint}
          </p>
        ) : null}
      </div>

      <AlertDialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.issueDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{m.issueDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.issueDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmIssue()}>
              {m.issueDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{m.deleteDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.deleteDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              {m.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function ReadOnlyPurchaseOrder({ order }: { order: PurchaseOrder }) {
  const role = useSignedInUser().role;
  const canReceive = GOODS_RECEIPT_ROLES.write.includes(role);
  const m = purchaseOrdersMessages.form;
  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-6">
      <div className="flex items-center gap-2">
        <Badge variant={order.status === "ISSUED" ? "success" : "secondary"}>
          {documentStatusLabels[order.status]}
        </Badge>
        {order.goodsReceipt?.status === "ISSUED" ? (
          <Badge variant="secondary">{goodsReceiptsMessages.receivedBadge}</Badge>
        ) : null}
      </div>

      <dl className="grid max-w-3xl grid-cols-3 gap-4 rounded-md border border-border p-4">
        <div>
          <dt className="text-caption text-muted-foreground">{m.supplier}</dt>
          <dd className="text-body font-medium">
            {order.supplier.name} ({order.supplier.rif})
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.currency}</dt>
          <dd className="text-body font-medium">{m.currencies[order.currency]}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.documentDate}</dt>
          <dd className="text-body font-medium tabular-nums">{formatDate(order.documentDate)}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{m.linesHeading}</h2>
        {order.lines.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-6 text-center text-body text-muted-foreground">
            {m.noLines}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted">
                  <TableHead>{m.product}</TableHead>
                  <TableHead className="w-32 text-right">{m.quantity}</TableHead>
                  <TableHead className="w-40 text-right">{m.unitCost}</TableHead>
                  <TableHead className="w-24">{m.iva}</TableHead>
                  <TableHead className="w-36 text-right">{m.lineSubtotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      {line.productSku} — {line.productName} (
                      {unitOfMeasureLabels[line.unitOfMeasure]})
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(line.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.unitCost.minorUnits, line.unitCost.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {taxRateColumnLabels[line.taxRate]}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(line.lineTotal.minorUnits, line.lineTotal.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <TotalsCard
        currency={order.currency}
        subtotal={order.totals.subtotal.minorUnits}
        ivaGeneral={order.totals.ivaByRate.general.minorUnits}
        ivaReduced={order.totals.ivaByRate.reduced.minorUnits}
        total={order.totals.total.minorUnits}
        frozenRate={order.status === "ISSUED" && order.currency === "USD" ? order.frozenRate : null}
        vesTotalEquivalent={order.vesTotalEquivalent}
      />

      <div className="flex items-center gap-2">
        {order.status === "ISSUED" && order.goodsReceipt !== null ? (
          <Button asChild variant="outline">
            <Link to="/recepciones-de-mercancia/$id" params={{ id: order.goodsReceipt.id }}>
              {goodsReceiptsMessages.viewReceiptAction}
            </Link>
          </Button>
        ) : null}
        {order.status === "ISSUED" && order.goodsReceipt === null && canReceive ? (
          <Button asChild>
            <Link to="/recepciones-de-mercancia/nueva" search={{ orden: order.id }}>
              {goodsReceiptsMessages.receiveOrderAction}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/ordenes-de-compra" search={defaultPurchaseOrdersSearch}>
            {m.back}
          </Link>
        </Button>
      </div>
    </div>
  );
}
