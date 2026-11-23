import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_NAME_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
  SUPPLIER_FIELDS,
} from "@cuadre/contracts";
import { parseRif } from "@cuadre/shared-kernel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateSupplier } from "@/api/suppliers";
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
import {
  errorMessages,
  supplierFieldMessage,
  supplierFieldMessages,
  suppliersMessages,
} from "@/messages";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function CreateSupplierDialog({
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
