import {
  CONTROL_NUMBER_MAX_LENGTH,
  type CreateGoodsReceiptRequest,
  type FieldIssue,
  GOODS_RECEIPT_ROLES,
  type GoodsReceipt,
  type PurchaseOrder,
  SUPPLIER_INVOICE_NUMBER_MAX_LENGTH,
  type TaxRate,
  UNIT_ALLOWS_DECIMALS,
  type UnitOfMeasure,
  type UpdateGoodsReceiptRequest,
} from "@cuadre/contracts";
import {
  type Currency,
  computeDocumentTotals,
  type money,
  parseQuantity,
} from "@cuadre/shared-kernel";
import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiResult } from "@/api/client";
import { usePurchaseOrder, usePurchaseOrders } from "@/api/purchase-orders";
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
import { defaultGoodsReceiptsSearch } from "@/features/purchasing/goods-receipts-search";
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
  goodsReceiptFieldMessage,
  goodsReceiptFieldMessages,
  goodsReceiptsMessages,
  priceParseMessages,
  purchaseOrdersMessages,
  taxRateColumnLabels,
  unitOfMeasureLabels,
} from "@/messages";

type DraftLineState = {
  readonly purchaseOrderLineId: string;
  readonly productSku: string;
  readonly productName: string;
  readonly unitOfMeasure: UnitOfMeasure;
  readonly taxRate: TaxRate;
  readonly orderedQuantity: string;
  quantity: string;
  unitCost: string;
};

type FieldErrors = Record<string, string>;

function linesFromOrder(order: PurchaseOrder): DraftLineState[] {
  return order.lines.map((line) => ({
    purchaseOrderLineId: line.id,
    productSku: line.productSku,
    productName: line.productName,
    unitOfMeasure: line.unitOfMeasure,
    taxRate: line.taxRate,
    orderedQuantity: line.quantity,
    quantity: formatQuantity(line.quantity),
    unitCost: formatAmount(line.unitCost.minorUnits),
  }));
}

function linesFromReceipt(receipt: GoodsReceipt): DraftLineState[] {
  return receipt.lines.map((line) => ({
    purchaseOrderLineId: line.purchaseOrderLineId,
    productSku: line.productSku,
    productName: line.productName,
    unitOfMeasure: line.unitOfMeasure,
    taxRate: line.taxRate,
    orderedQuantity: line.orderedQuantity,
    quantity: formatQuantity(line.quantity),
    unitCost: formatAmount(line.unitCost.minorUnits),
  }));
}

export function GoodsReceiptEditor({
  initialReceipt,
  initialPurchaseOrderId,
  isSaving,
  isDeleting,
  isIssuing,
  onCreate,
  onUpdate,
  onDelete,
  onIssue,
}: {
  initialReceipt?: GoodsReceipt;
  initialPurchaseOrderId?: string | undefined;
  isSaving: boolean;
  isDeleting?: boolean;
  isIssuing?: boolean;
  onCreate?: (body: CreateGoodsReceiptRequest) => Promise<ApiResult<GoodsReceipt>>;
  onUpdate?: (body: UpdateGoodsReceiptRequest) => Promise<ApiResult<GoodsReceipt>>;
  onDelete?: () => Promise<ApiResult<undefined>>;
  onIssue?: () => Promise<ApiResult<GoodsReceipt>>;
}) {
  const role = useSignedInUser().role;
  const canWrite = GOODS_RECEIPT_ROLES.write.includes(role);
  const navigate = useNavigate();
  const announce = useStatusAnnouncer();

  const isCreate = initialReceipt === undefined;
  const canEdit = canWrite && initialReceipt?.status !== "ISSUED";

  const [purchaseOrderId, setPurchaseOrderId] = useState(
    initialReceipt?.purchaseOrder.id ?? initialPurchaseOrderId ?? "",
  );
  // Read-only views never query the unreceived PO list.
  const eligibleOrdersQuery = usePurchaseOrders({ page: 1, unreceived: true }, canEdit && isCreate);
  const selectedOrderQuery = usePurchaseOrder(
    purchaseOrderId,
    canEdit && isCreate && purchaseOrderId !== "",
  );
  const selectedOrder = selectedOrderQuery.data;

  const currency: Currency = initialReceipt?.currency ?? selectedOrder?.currency ?? "USD";
  const supplierDisplay = initialReceipt
    ? `${initialReceipt.supplier.name} (${initialReceipt.supplier.rif})`
    : selectedOrder
      ? `${selectedOrder.supplier.name} (${selectedOrder.supplier.rif})`
      : "—";

  const [documentDate, setDocumentDate] = useState(
    formatDate(initialReceipt?.documentDate ?? todayCaracas()),
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    initialReceipt?.supplierInvoiceNumber ?? "",
  );
  const [controlNumber, setControlNumber] = useState(initialReceipt?.controlNumber ?? "");
  const [lines, setLines] = useState<DraftLineState[]>(() =>
    initialReceipt === undefined ? [] : linesFromReceipt(initialReceipt),
  );
  const prefilledOrderRef = useRef<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCreate || selectedOrder === undefined) return;
    if (prefilledOrderRef.current === selectedOrder.id) return;
    prefilledOrderRef.current = selectedOrder.id;
    setLines(linesFromOrder(selectedOrder));
    setFieldErrors({});
  }, [isCreate, selectedOrder]);

  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  const isDirty = useMemo(() => {
    if (initialReceipt === undefined) return false;
    if (documentDate !== formatDate(initialReceipt.documentDate)) return true;
    if (supplierInvoiceNumber !== initialReceipt.supplierInvoiceNumber) return true;
    if (controlNumber !== initialReceipt.controlNumber) return true;
    if (lines.length !== initialReceipt.lines.length) return true;
    return lines.some((line, index) => {
      const orig = initialReceipt.lines[index];
      if (orig === undefined) return true;
      return (
        line.purchaseOrderLineId !== orig.purchaseOrderLineId ||
        line.quantity !== formatQuantity(orig.quantity) ||
        line.unitCost !== formatAmount(orig.unitCost.minorUnits)
      );
    });
  }, [initialReceipt, documentDate, supplierInvoiceNumber, controlNumber, lines]);

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
      taxRate: TaxRate;
    }[] = [];
    const lineTotalsById = new Map<string, number>();

    for (const line of lines) {
      const qtyCanonical = parseQuantityInput(line.quantity, {
        allowDecimals: UNIT_ALLOWS_DECIMALS[line.unitOfMeasure],
      });
      const cost = toMoney(line.unitCost, currency);
      if (!qtyCanonical.ok || !cost.ok || cost.value.minorUnits <= 0) continue;
      const qty = parseQuantity(qtyCanonical.value, {
        allowDecimals: UNIT_ALLOWS_DECIMALS[line.unitOfMeasure],
      });
      if (!qty.ok) continue;

      const single = computeDocumentTotals(
        [{ quantity: qty.value, unitPrice: cost.value, taxRate: line.taxRate }],
        currency,
      );
      if (single.ok && single.value.lineTotals[0] !== undefined) {
        lineTotalsById.set(line.purchaseOrderLineId, single.value.lineTotals[0].minorUnits);
      }
      validLines.push({ quantity: qty.value, unitPrice: cost.value, taxRate: line.taxRate });
    }

    const totals = computeDocumentTotals(validLines, currency);
    return {
      lineTotalsById,
      totals: totals.ok ? totals.value : undefined,
    };
  }, [lines, currency]);

  if (!canWrite && initialReceipt === undefined) {
    return (
      <div className="max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)]">
        <Alert variant="destructive" role="alert" className="block">
          {goodsReceiptsMessages.errors.FORBIDDEN_WRITE}
        </Alert>
      </div>
    );
  }

  if (initialReceipt !== undefined && (initialReceipt.status === "ISSUED" || !canWrite)) {
    return <ReadOnlyGoodsReceipt receipt={initialReceipt} />;
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

  function updateLine(
    index: number,
    patch: Partial<Pick<DraftLineState, "quantity" | "unitCost">>,
  ) {
    setLines((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function applyValidationIssues(issues: readonly FieldIssue[]): boolean {
    const serverErrors: FieldErrors = {};
    let linesError: string | undefined;
    for (const issue of issues) {
      const msg = goodsReceiptFieldMessage(issue.field, issue.code);
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
    if (isCreate && purchaseOrderId.trim() === "") {
      errors.purchaseOrderId = goodsReceiptFieldMessages.purchaseOrderId.REQUIRED ?? "";
    }

    const trimmedInvoice = supplierInvoiceNumber.trim();
    if (trimmedInvoice === "") {
      errors.supplierInvoiceNumber = goodsReceiptFieldMessages.supplierInvoiceNumber.REQUIRED ?? "";
    } else if (trimmedInvoice.length > SUPPLIER_INVOICE_NUMBER_MAX_LENGTH) {
      errors.supplierInvoiceNumber = goodsReceiptFieldMessages.supplierInvoiceNumber.TOO_LONG ?? "";
    }

    const trimmedControl = controlNumber.trim();
    if (trimmedControl === "") {
      errors.controlNumber = goodsReceiptFieldMessages.controlNumber.REQUIRED ?? "";
    } else if (trimmedControl.length > CONTROL_NUMBER_MAX_LENGTH) {
      errors.controlNumber = goodsReceiptFieldMessages.controlNumber.TOO_LONG ?? "";
    }

    let isoDate = "";
    if (documentDate.trim() === "") {
      errors.documentDate = goodsReceiptFieldMessages.documentDate.REQUIRED ?? "";
    } else {
      const parsedDate = parseDate(documentDate);
      if (!parsedDate.ok) {
        errors.documentDate = goodsReceiptFieldMessages.documentDate.INVALID_DATE ?? "";
      } else if (parsedDate.value > todayCaracas()) {
        errors.documentDate = goodsReceiptFieldMessages.documentDate.DOCUMENT_DATE_IN_FUTURE ?? "";
      } else {
        isoDate = parsedDate.value;
      }
    }

    const requestLines: UpdateGoodsReceiptRequest["lines"] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const allowDecimals = UNIT_ALLOWS_DECIMALS[line.unitOfMeasure];
      const parsedQty = parseQuantityInput(line.quantity, { allowDecimals });
      if (!parsedQty.ok) {
        errors[`lines.${i}.quantity`] =
          goodsReceiptFieldMessages.quantity[parsedQty.error] ??
          goodsReceiptFieldMessages.quantity.INVALID_FORMAT ??
          "";
      } else {
        const ordered = parseQuantity(line.orderedQuantity, { allowDecimals: true });
        const received = parseQuantity(parsedQty.value, { allowDecimals });
        if (ordered.ok && received.ok && received.value.scaled > ordered.value.scaled) {
          errors[`lines.${i}.quantity`] =
            goodsReceiptFieldMessages.quantity.QUANTITY_EXCEEDS_ORDERED ?? "";
        }
      }

      let costMinor = 0;
      if (line.unitCost.trim() === "") {
        errors[`lines.${i}.unitCost`] = goodsReceiptFieldMessages.unitCost.REQUIRED ?? "";
      } else {
        const parsedCost = toMoney(line.unitCost, currency);
        if (!parsedCost.ok) {
          errors[`lines.${i}.unitCost`] = priceParseMessages[parsedCost.error];
        } else if (parsedCost.value.minorUnits <= 0) {
          errors[`lines.${i}.unitCost`] = goodsReceiptFieldMessages.unitCost.NOT_POSITIVE ?? "";
        } else {
          costMinor = parsedCost.value.minorUnits;
        }
      }

      if (errors[`lines.${i}.quantity`] === undefined && parsedQty.ok && costMinor > 0) {
        requestLines.push({
          purchaseOrderLineId: line.purchaseOrderLineId,
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
    const result = isCreate
      ? await onCreate?.({
          purchaseOrderId,
          documentDate: isoDate,
          supplierInvoiceNumber: trimmedInvoice,
          controlNumber: trimmedControl,
          lines: requestLines,
        })
      : await onUpdate?.({
          documentDate: isoDate,
          supplierInvoiceNumber: trimmedInvoice,
          controlNumber: trimmedControl,
          lines: requestLines,
        });
    if (result === undefined) return;

    if (result.ok) {
      announce(goodsReceiptsMessages.saved);
      if (isCreate) {
        await navigate({ to: "/recepciones-de-mercancia/$id", params: { id: result.value.id } });
      }
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
      setFormError(goodsReceiptsMessages.errors.FORBIDDEN_WRITE);
      return;
    }
    if (failure.code === "DOCUMENT_NOT_DRAFT") {
      setFormError(goodsReceiptsMessages.errors.DOCUMENT_NOT_DRAFT);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(goodsReceiptsMessages.errors.saveFailed);
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
      announce(goodsReceiptsMessages.deleted);
      await navigate({ to: "/recepciones-de-mercancia", search: defaultGoodsReceiptsSearch });
      return;
    }
    if (result.error.code === "UNAUTHORIZED") return;
    if (result.error.code === "DOCUMENT_NOT_DRAFT") {
      setFormError(goodsReceiptsMessages.errors.DOCUMENT_NOT_DRAFT);
      return;
    }
    setFormError(goodsReceiptsMessages.errors.deleteFailed);
  }

  async function handleConfirmIssue() {
    if (onIssue === undefined) return;
    setFormError(undefined);
    setFieldErrors({});
    const result = await onIssue();
    setIssueDialogOpen(false);
    if (result.ok) {
      announce(goodsReceiptsMessages.issued);
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
      setFormError(goodsReceiptsMessages.errors.FORBIDDEN_WRITE);
      return;
    }
    if (failure.code === "EMPTY_DOCUMENT") {
      setFormError(goodsReceiptsMessages.errors.EMPTY_DOCUMENT);
      return;
    }
    if (failure.code === "DOCUMENT_NOT_DRAFT") {
      setFormError(goodsReceiptsMessages.errors.DOCUMENT_NOT_DRAFT);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(goodsReceiptsMessages.errors.issueFailed);
      return;
    }
    setFormError(
      errorMessages[failure.code]({
        ...(failure.date === undefined ? {} : { date: failure.date }),
      }),
    );
  }

  const m = goodsReceiptsMessages.form;
  const eligibleOrders = eligibleOrdersQuery.data?.items ?? [];

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-6"
    >
      {initialReceipt === undefined ? null : (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{documentStatusLabels[initialReceipt.status]}</Badge>
        </div>
      )}

      <div className="grid max-w-3xl grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gr-order">{m.purchaseOrder}</Label>
          {isCreate ? (
            <>
              <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                <SelectTrigger
                  id="gr-order"
                  aria-required="true"
                  aria-invalid={fieldErrors.purchaseOrderId !== undefined}
                  className="w-full"
                >
                  <SelectValue placeholder={m.purchaseOrderPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOrders.length === 0 ? (
                    <div className="px-3 py-2 text-caption text-muted-foreground">
                      {goodsReceiptsMessages.noEligibleOrders}
                    </div>
                  ) : (
                    eligibleOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {m.purchaseOrderOption(
                          formatDate(po.documentDate),
                          po.supplier.name,
                          formatMoney(po.totals.total.minorUnits, po.totals.total.currency),
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.purchaseOrderId === undefined ? null : (
                <p className="text-caption text-destructive">{fieldErrors.purchaseOrderId}</p>
              )}
            </>
          ) : (
            <div className="flex min-h-(--control-height) items-center rounded-md border border-border bg-muted px-3 text-body">
              <Link
                to="/ordenes-de-compra/$id"
                params={{ id: initialReceipt.purchaseOrder.id }}
                className="font-medium text-primary underline-offset-4 hover:underline tabular-nums"
              >
                {formatDate(initialReceipt.purchaseOrder.documentDate)} —{" "}
                {initialReceipt.supplier.name}
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gr-date">{m.documentDate}</Label>
          <Input
            id="gr-date"
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gr-invoice">{m.supplierInvoiceNumber}</Label>
          <Input
            id="gr-invoice"
            value={supplierInvoiceNumber}
            onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
            placeholder={m.supplierInvoicePlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-invalid={fieldErrors.supplierInvoiceNumber !== undefined}
          />
          {fieldErrors.supplierInvoiceNumber === undefined ? null : (
            <p className="text-caption text-destructive">{fieldErrors.supplierInvoiceNumber}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gr-control">{m.controlNumber}</Label>
          <Input
            id="gr-control"
            value={controlNumber}
            onChange={(e) => setControlNumber(e.target.value)}
            placeholder={m.controlNumberPlaceholder}
            autoComplete="off"
            aria-required="true"
            aria-invalid={fieldErrors.controlNumber !== undefined}
          />
          {fieldErrors.controlNumber === undefined ? null : (
            <p className="text-caption text-destructive">{fieldErrors.controlNumber}</p>
          )}
        </div>
      </div>

      <dl className="grid max-w-3xl grid-cols-2 gap-4 rounded-md border border-border p-4">
        <div>
          <dt className="text-caption text-muted-foreground">{m.supplier}</dt>
          <dd className="text-body font-medium">{supplierDisplay}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.currency}</dt>
          <dd className="text-body font-medium">
            {purchaseOrdersMessages.form.currencies[currency]}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{m.linesHeading}</h2>

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
                  <TableHead className="w-28 text-right">{m.orderedQuantity}</TableHead>
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
                  const lineSubtotal = liveTotals.lineTotalsById.get(line.purchaseOrderLineId);
                  const qtyErr = fieldErrors[`lines.${index}.quantity`];
                  const costErr = fieldErrors[`lines.${index}.unitCost`];

                  return (
                    <TableRow key={line.purchaseOrderLineId}>
                      <TableCell className="align-top pt-3">
                        {line.productSku} — {line.productName} (
                        {unitOfMeasureLabels[line.unitOfMeasure]})
                      </TableCell>
                      <TableCell className="align-top pt-3 text-right tabular-nums text-muted-foreground">
                        {formatQuantity(line.orderedQuantity)}
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
                        {taxRateColumnLabels[line.taxRate]}
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
                aria-describedby={isDirty ? "gr-issue-dirty-hint" : undefined}
                onClick={() => setIssueDialogOpen(true)}
              >
                {isIssuing ? m.issuing : m.issue}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/recepciones-de-mercancia" search={defaultGoodsReceiptsSearch}>
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
          <p id="gr-issue-dirty-hint" className="text-caption text-muted-foreground">
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

function ReadOnlyGoodsReceipt({ receipt }: { receipt: GoodsReceipt }) {
  const m = goodsReceiptsMessages.form;
  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-6">
      <div className="flex items-center gap-2">
        <Badge variant={receipt.status === "ISSUED" ? "success" : "secondary"}>
          {documentStatusLabels[receipt.status]}
        </Badge>
      </div>

      <dl className="grid max-w-3xl grid-cols-3 gap-4 rounded-md border border-border p-4">
        <div>
          <dt className="text-caption text-muted-foreground">{m.purchaseOrder}</dt>
          <dd className="text-body font-medium">
            <Link
              to="/ordenes-de-compra/$id"
              params={{ id: receipt.purchaseOrder.id }}
              className="text-primary underline-offset-4 hover:underline tabular-nums"
            >
              {formatDate(receipt.purchaseOrder.documentDate)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.supplier}</dt>
          <dd className="text-body font-medium">
            {receipt.supplier.name} ({receipt.supplier.rif})
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.documentDate}</dt>
          <dd className="text-body font-medium tabular-nums">{formatDate(receipt.documentDate)}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.supplierInvoiceNumber}</dt>
          <dd className="text-body font-medium tabular-nums">{receipt.supplierInvoiceNumber}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.controlNumber}</dt>
          <dd className="text-body font-medium tabular-nums">{receipt.controlNumber}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{m.currency}</dt>
          <dd className="text-body font-medium">
            {purchaseOrdersMessages.form.currencies[receipt.currency]}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{m.linesHeading}</h2>
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted">
                <TableHead>{m.product}</TableHead>
                <TableHead className="w-28 text-right">{m.orderedQuantity}</TableHead>
                <TableHead className="w-32 text-right">{m.quantity}</TableHead>
                <TableHead className="w-40 text-right">{m.unitCost}</TableHead>
                <TableHead className="w-24">{m.iva}</TableHead>
                <TableHead className="w-36 text-right">{m.lineSubtotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.productSku} — {line.productName} (
                    {unitOfMeasureLabels[line.unitOfMeasure]})
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatQuantity(line.orderedQuantity)}
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
      </section>

      <TotalsCard
        currency={receipt.currency}
        subtotal={receipt.totals.subtotal.minorUnits}
        ivaGeneral={receipt.totals.ivaByRate.general.minorUnits}
        ivaReduced={receipt.totals.ivaByRate.reduced.minorUnits}
        total={receipt.totals.total.minorUnits}
        frozenRate={
          receipt.status === "ISSUED" && receipt.currency === "USD" ? receipt.frozenRate : null
        }
        vesTotalEquivalent={receipt.vesTotalEquivalent}
      />

      <div>
        <Button asChild variant="outline">
          <Link to="/recepciones-de-mercancia" search={defaultGoodsReceiptsSearch}>
            {m.back}
          </Link>
        </Button>
      </div>
    </div>
  );
}
