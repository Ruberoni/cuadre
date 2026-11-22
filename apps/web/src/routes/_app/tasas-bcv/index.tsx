import {
  EXCHANGE_RATE_FIELDS,
  EXCHANGE_RATE_MAX_DAYS_AHEAD,
  EXCHANGE_RATE_ROLES,
  EXCHANGE_RATES_PAGE_SIZE,
  type ExchangeRate,
} from "@cuadre/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  useCorrectExchangeRate,
  useExchangeRates,
  useRecordExchangeRate,
} from "@/api/exchange-rates";
import { usePageTitle, useSignedInUser, useStatusAnnouncer } from "@/components/app-layout";
import { type Column, DataTable, Pager } from "@/components/data-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { exchangeRatesSearchSchema } from "@/features/exchange-rates/search";
import {
  addDays,
  formatBcvRate,
  formatDate,
  formatRate,
  parseDate,
  parseRateInput,
  todayCaracas,
} from "@/lib/format";
import {
  errorMessages,
  exchangeRateFieldMessage,
  exchangeRateFieldMessages,
  exchangeRatesMessages,
  rateParseMessages,
} from "@/messages";

export const Route = createFileRoute("/_app/tasas-bcv/")({
  validateSearch: (search: Record<string, unknown>) => exchangeRatesSearchSchema.parse(search),
  component: ExchangeRatesList,
});

type DialogMode = { mode: "record" } | { mode: "correct"; date: string; currentRate: string };

function ExchangeRatesList() {
  usePageTitle(exchangeRatesMessages.pageTitle);
  const canWrite = EXCHANGE_RATE_ROLES.write.includes(useSignedInUser().role);
  const { page, registrar } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const rates = useExchangeRates(page);
  const announce = useStatusAnnouncer();
  const [dialog, setDialog] = useState<DialogMode | undefined>(undefined);

  useEffect(() => {
    if (!registrar) return;
    if (canWrite) setDialog({ mode: "record" });
    void navigate({
      search: (previous) => ({ page: previous.page }),
      replace: true,
    });
  }, [registrar, canWrite, navigate]);

  const columns: readonly Column<ExchangeRate>[] = useMemo(() => {
    const base: Column<ExchangeRate>[] = [
      {
        id: "date",
        header: exchangeRatesMessages.columns.date,
        cell: (row) => <span className="font-medium tabular-nums">{formatDate(row.date)}</span>,
      },
      {
        id: "rate",
        header: exchangeRatesMessages.columns.rate,
        align: "right",
        cell: (row) => <span className="tabular-nums">{formatBcvRate(row.rate)}</span>,
      },
      {
        id: "status",
        header: exchangeRatesMessages.columns.status,
        cell: (row) =>
          row.frozen ? (
            <Badge variant="secondary">{exchangeRatesMessages.frozenBadge}</Badge>
          ) : null,
      },
    ];
    if (canWrite) {
      base.push({
        id: "actions",
        header: exchangeRatesMessages.columns.actions,
        align: "right",
        cell: (row) =>
          row.frozen ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog({ mode: "correct", date: row.date, currentRate: row.rate })}
            >
              {exchangeRatesMessages.correctAction}
            </Button>
          ),
      });
    }
    return base;
  }, [canWrite]);

  const data = rates.data;
  const settled = data !== undefined && !rates.isPlaceholderData;
  const noRatesAtAll = settled && data.total === 0;

  const lastPage = data === undefined ? 1 : Math.max(1, Math.ceil(data.total / data.pageSize));
  useEffect(() => {
    if (settled && data.total > 0 && page > lastPage) {
      void navigate({ search: (previous) => ({ ...previous, page: lastPage }), replace: true });
    }
  }, [settled, data, page, lastPage, navigate]);

  const goToPage = (target: number) =>
    navigate({ search: (previous) => ({ ...previous, page: target }) });

  return (
    <div className="flex max-w-[calc(var(--viewport-min)-var(--sidebar-width)-var(--space-6)*2)] flex-col gap-4">
      {noRatesAtAll ? (
        <EmptyState
          title={exchangeRatesMessages.empty.title}
          description={
            canWrite
              ? exchangeRatesMessages.empty.description
              : exchangeRatesMessages.empty.readOnlyDescription
          }
          action={
            canWrite ? (
              <Button type="button" onClick={() => setDialog({ mode: "record" })}>
                {exchangeRatesMessages.registerAction}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canWrite ? (
            <div className="flex justify-end">
              <Button type="button" onClick={() => setDialog({ mode: "record" })}>
                {exchangeRatesMessages.registerAction}
              </Button>
            </div>
          ) : null}

          {rates.isError && data === undefined ? (
            <Alert variant="destructive" className="flex items-center justify-between gap-4">
              <span>{exchangeRatesMessages.loadError}</span>
              <Button
                variant="outline"
                loading={rates.isFetching}
                onClick={() => void rates.refetch()}
              >
                {exchangeRatesMessages.retry}
              </Button>
            </Alert>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(row) => row.date}
                caption={exchangeRatesMessages.tableCaption}
                loading={data === undefined}
                busy={rates.isFetching}
              />
              {data === undefined ? null : (
                <Pager
                  summary={exchangeRatesMessages.pager(
                    (data.page - 1) * EXCHANGE_RATES_PAGE_SIZE + 1,
                    (data.page - 1) * EXCHANGE_RATES_PAGE_SIZE + data.items.length,
                    data.total,
                  )}
                  previousLabel={exchangeRatesMessages.previousPage}
                  nextLabel={exchangeRatesMessages.nextPage}
                  hasPrevious={data.page > 1}
                  hasNext={data.page * data.pageSize < data.total}
                  busy={rates.isFetching}
                  onPrevious={() => void goToPage(data.page - 1)}
                  onNext={() => void goToPage(data.page + 1)}
                />
              )}
            </>
          )}
        </>
      )}

      <ExchangeRateDialog
        dialog={dialog}
        onClose={() => setDialog(undefined)}
        onDone={(message) => {
          setDialog(undefined);
          announce(message, { persistAcrossNextNavigation: false });
        }}
      />
    </div>
  );
}

const formSchema = z.object({
  date: z.string().superRefine((text, context) => {
    const trimmed = text.trim();
    if (trimmed === "") {
      context.addIssue({ code: "custom", message: exchangeRateFieldMessages.date.REQUIRED ?? "" });
      return;
    }
    const parsed = parseDate(trimmed);
    if (!parsed.ok) {
      context.addIssue({
        code: "custom",
        message: exchangeRateFieldMessages.date.INVALID_DATE ?? "",
      });
      return;
    }
    const maxDate = addDays(todayCaracas(), EXCHANGE_RATE_MAX_DAYS_AHEAD);
    if (parsed.value > maxDate) {
      context.addIssue({ code: "custom", message: errorMessages.RATE_DATE_TOO_FAR({}) });
    }
  }),
  rate: z.string().superRefine((text, context) => {
    if (text.trim() === "") {
      context.addIssue({ code: "custom", message: exchangeRateFieldMessages.rate.REQUIRED ?? "" });
      return;
    }
    const parsed = parseRateInput(text);
    if (!parsed.ok) {
      context.addIssue({ code: "custom", message: rateParseMessages[parsed.error] });
    }
  }),
});
type FormValues = z.infer<typeof formSchema>;

const isFieldName = (name: string): name is keyof FormValues =>
  (EXCHANGE_RATE_FIELDS as readonly string[]).includes(name);

function ExchangeRateDialog({
  dialog,
  onClose,
  onDone,
}: {
  dialog: DialogMode | undefined;
  onClose: () => void;
  onDone: (statusMessage: string) => void;
}) {
  const recordRate = useRecordExchangeRate();
  const correctRate = useCorrectExchangeRate();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const alertRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: "", rate: "" },
  });
  const { reset, setFocus } = form;

  useEffect(() => {
    if (dialog === undefined) return;
    setFormError(undefined);
    if (dialog.mode === "record") {
      reset({ date: formatDate(todayCaracas()), rate: "" });
    } else {
      reset({ date: formatDate(dialog.date), rate: formatRate(dialog.currentRate) });
    }
  }, [dialog, reset]);

  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  const busy = recordRate.isPending || correctRate.isPending;

  async function onSubmit(values: FormValues) {
    if (dialog === undefined) return;
    setFormError(undefined);
    const parsedDate = parseDate(values.date);
    const parsedRate = parseRateInput(values.rate);
    if (!parsedDate.ok || !parsedRate.ok) return;

    const result =
      dialog.mode === "record"
        ? await recordRate.mutateAsync({ date: parsedDate.value, rate: parsedRate.value })
        : await correctRate.mutateAsync({ date: dialog.date, rate: parsedRate.value });

    if (result.ok) {
      const displayDate = formatDate(result.value.date);
      onDone(
        dialog.mode === "record"
          ? exchangeRatesMessages.recorded(displayDate)
          : exchangeRatesMessages.corrected(displayDate),
      );
      return;
    }

    const failure = result.error;
    if (failure.code === "UNAUTHORIZED") return;
    if (failure.code === "RATE_ALREADY_EXISTS") {
      form.setError(
        "date",
        {
          message: errorMessages.RATE_ALREADY_EXISTS({
            ...(failure.date ? { date: failure.date } : {}),
          }),
        },
        { shouldFocus: true },
      );
      return;
    }
    if (failure.code === "RATE_DATE_TOO_FAR") {
      form.setError(
        "date",
        { message: errorMessages.RATE_DATE_TOO_FAR({}) },
        { shouldFocus: true },
      );
      return;
    }
    if (failure.code === "RATE_ALREADY_FROZEN") {
      setFormError(errorMessages.RATE_ALREADY_FROZEN({}));
      return;
    }
    if (failure.code === "VALIDATION_ERROR") {
      let focused = false;
      for (const issue of failure.issues ?? []) {
        const message = exchangeRateFieldMessage(issue.field, issue.code);
        if (message === undefined || !isFieldName(issue.field)) continue;
        form.setError(issue.field, { message }, { shouldFocus: !focused });
        focused = true;
      }
      if (focused) return;
    }
    if (failure.code === "FORBIDDEN") {
      setFormError(exchangeRatesMessages.errors.FORBIDDEN);
      return;
    }
    setFormError(exchangeRatesMessages.errors.saveFailed);
  }

  return (
    <Dialog open={dialog !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          setFocus(dialog?.mode === "correct" ? "rate" : "date");
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {dialog?.mode === "correct"
              ? exchangeRatesMessages.form.correctTitle
              : exchangeRatesMessages.form.recordTitle}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{exchangeRatesMessages.form.date}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      readOnly={dialog?.mode === "correct"}
                      aria-readonly={dialog?.mode === "correct" || undefined}
                      placeholder={exchangeRatesMessages.form.datePlaceholder}
                      autoComplete="off"
                      aria-required="true"
                      className={
                        dialog?.mode === "correct" ? "bg-muted tabular-nums" : "tabular-nums"
                      }
                    />
                  </FormControl>
                  {dialog?.mode === "record" ? (
                    <FormDescription>{exchangeRatesMessages.form.dateHelp}</FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{exchangeRatesMessages.form.rate}</FormLabel>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-muted-foreground"
                    >
                      {exchangeRatesMessages.form.currencyPrefix}
                    </span>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-required="true"
                        className="pl-10 tabular-nums"
                      />
                    </FormControl>
                  </div>
                  <FormDescription>{exchangeRatesMessages.form.rateHelp}</FormDescription>
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
                {exchangeRatesMessages.form.cancel}
              </Button>
              <Button type="submit" loading={busy}>
                {busy ? exchangeRatesMessages.form.submitting : exchangeRatesMessages.form.submit}
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
