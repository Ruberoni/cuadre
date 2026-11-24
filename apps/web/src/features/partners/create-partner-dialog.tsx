import {
  type CreatePartnerRequest,
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_FIELDS,
  PARTNER_NAME_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
  type Partner,
} from "@cuadre/contracts";
import { parseRif } from "@cuadre/shared-kernel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ApiResult } from "@/api/client";
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
import { errorMessages, partnerFieldMessage, partnerFieldMessages } from "@/messages";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formSchema = z.object({
  rif: z.string().superRefine((text, context) => {
    const parsed = parseRif(text);
    if (!parsed.ok) {
      context.addIssue({
        code: "custom",
        message: partnerFieldMessages.rif[parsed.error] ?? "",
      });
    }
  }),
  name: z
    .string()
    .trim()
    .min(1, partnerFieldMessages.name.REQUIRED)
    .max(PARTNER_NAME_MAX_LENGTH, partnerFieldMessages.name.TOO_LONG),
  phone: z.string().trim().max(PARTNER_PHONE_MAX_LENGTH, partnerFieldMessages.phone.TOO_LONG),
  email: z.string().superRefine((text, context) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    if (trimmed.length > PARTNER_EMAIL_MAX_LENGTH) {
      context.addIssue({ code: "custom", message: partnerFieldMessages.email.TOO_LONG ?? "" });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      context.addIssue({
        code: "custom",
        message: partnerFieldMessages.email.INVALID_FORMAT ?? "",
      });
    }
  }),
  address: z.string().trim().max(PARTNER_ADDRESS_MAX_LENGTH, partnerFieldMessages.address.TOO_LONG),
});
type FormValues = z.infer<typeof formSchema>;

const isFieldName = (name: string): name is keyof FormValues =>
  (PARTNER_FIELDS as readonly string[]).includes(name);

export type PartnerDialogMessages = {
  readonly form: {
    readonly title: string;
    readonly rif: string;
    readonly rifPlaceholder: string;
    readonly rifHelp: string;
    readonly name: string;
    readonly phone: string;
    readonly email: string;
    readonly emailPlaceholder: string;
    readonly address: string;
    readonly submit: string;
    readonly confirmExistingSubmit: string;
    readonly existingPartnerWarning: (rif: string, partnerName: string) => string;
    readonly submitting: string;
    readonly cancel: string;
  };
  readonly errors: {
    readonly FORBIDDEN: string;
    readonly saveFailed: string;
  };
};

type ExistingPartnerPrompt = {
  readonly rif: string;
  readonly name: string;
};

export function CreatePartnerDialog({
  open,
  onClose,
  onSaved,
  isPending,
  onSubmitPartner,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (rif: string, promoted: boolean) => void;
  isPending: boolean;
  onSubmitPartner: (request: CreatePartnerRequest) => Promise<ApiResult<Partner>>;
  messages: PartnerDialogMessages;
}) {
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [existingPartner, setExistingPartner] = useState<ExistingPartnerPrompt | undefined>(
    undefined,
  );
  const alertRef = useRef<HTMLDivElement>(null);
  const existingAlertRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { rif: "", name: "", phone: "", email: "", address: "" },
  });
  const { reset, setFocus } = form;

  useEffect(() => {
    if (!open) return;
    setFormError(undefined);
    setExistingPartner(undefined);
    reset({ rif: "", name: "", phone: "", email: "", address: "" });
  }, [open, reset]);

  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (existingPartner !== undefined) existingAlertRef.current?.focus();
  }, [existingPartner]);

  async function onSubmit(values: FormValues) {
    setFormError(undefined);
    const parsedRif = parseRif(values.rif);
    const confirming =
      existingPartner !== undefined && parsedRif.ok && parsedRif.value === existingPartner.rif;

    const result = await onSubmitPartner({
      rif: values.rif,
      name: values.name,
      phone: values.phone.trim() === "" ? null : values.phone.trim(),
      email: values.email.trim() === "" ? null : values.email.trim(),
      address: values.address.trim() === "" ? null : values.address.trim(),
      ...(confirming ? { confirmExistingPartner: true } : {}),
    });

    if (result.ok) {
      onSaved(result.value.rif, confirming);
      return;
    }

    const failure = result.error;
    if (failure.code === "UNAUTHORIZED") return;
    if (failure.code === "PARTNER_ALREADY_EXISTS") {
      setExistingPartner({
        rif: failure.rif ?? (parsedRif.ok ? parsedRif.value : values.rif),
        name: failure.partnerName ?? "",
      });
      return;
    }

    setExistingPartner(undefined);

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
        const message = partnerFieldMessage(issue.field, issue.code);
        if (message === undefined || !isFieldName(issue.field)) continue;
        form.setError(issue.field, { message }, { shouldFocus: !focused });
        focused = true;
      }
      if (focused) return;
    }
    if (failure.code === "FORBIDDEN") {
      setFormError(messages.errors.FORBIDDEN);
      return;
    }
    if (failure.code === "INTERNAL_ERROR" || failure.code === "NETWORK_ERROR") {
      setFormError(messages.errors.saveFailed);
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
          <DialogTitle>{messages.form.title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="rif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{messages.form.rif}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        if (existingPartner !== undefined) {
                          const parsed = parseRif(event.target.value);
                          if (!parsed.ok || parsed.value !== existingPartner.rif) {
                            setExistingPartner(undefined);
                          }
                        }
                      }}
                      placeholder={messages.form.rifPlaceholder}
                      autoComplete="off"
                      aria-required="true"
                    />
                  </FormControl>
                  <FormDescription>{messages.form.rifHelp}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{messages.form.name}</FormLabel>
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
                    <FormLabel>{messages.form.phone}</FormLabel>
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
                    <FormLabel>{messages.form.email}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={messages.form.emailPlaceholder}
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
                  <FormLabel>{messages.form.address}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {existingPartner === undefined ? null : (
              <Alert
                ref={existingAlertRef}
                variant="warning"
                role="alert"
                tabIndex={-1}
                className="block"
              >
                {existingPartner.name !== ""
                  ? messages.form.existingPartnerWarning(existingPartner.rif, existingPartner.name)
                  : errorMessages.PARTNER_ALREADY_EXISTS({ rif: existingPartner.rif })}
              </Alert>
            )}

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
                {messages.form.cancel}
              </Button>
              <Button type="submit" loading={isPending}>
                {isPending
                  ? messages.form.submitting
                  : existingPartner !== undefined
                    ? messages.form.confirmExistingSubmit
                    : messages.form.submit}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
