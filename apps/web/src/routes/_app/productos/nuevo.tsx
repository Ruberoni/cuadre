import {
  PRODUCT_FIELDS,
  PRODUCT_NAME_MAX_LENGTH,
  SKU_PATTERN,
  TAX_RATES,
  UNITS_OF_MEASURE,
} from "@cuadre/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateProduct } from "@/api/products";
import { usePageTitle, useStatusAnnouncer } from "@/components/app-layout";
import { MoneyInput, toMoney } from "@/components/money-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultProductsSearch } from "@/features/products/search";
import {
  errorMessages,
  priceParseMessages,
  productFieldMessage,
  productFieldMessages,
  productsMessages,
  taxRateLabels,
  unitOfMeasureLabels,
} from "@/messages";

export const Route = createFileRoute("/_app/productos/nuevo")({ component: NewProduct });

// The same rules as the domain, with the messages of the catalog. Values stay as typed; the price
// becomes `Money` on submit (no transform here, so form input and output types are the same).
const formSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, productFieldMessages.sku.REQUIRED)
    .regex(SKU_PATTERN, productFieldMessages.sku.INVALID_FORMAT),
  name: z
    .string()
    .trim()
    .min(1, productFieldMessages.name.REQUIRED)
    .max(PRODUCT_NAME_MAX_LENGTH, productFieldMessages.name.TOO_LONG),
  unitOfMeasure: z.string().min(1, productFieldMessages.unitOfMeasure.REQUIRED),
  salePrice: z.string().superRefine((text, context) => {
    if (text.trim() === "") {
      context.addIssue({ code: "custom", message: productFieldMessages.salePrice.REQUIRED ?? "" });
      return;
    }
    const price = toMoney(text, "USD");
    if (!price.ok) {
      context.addIssue({ code: "custom", message: priceParseMessages[price.error] });
    } else if (price.value.minorUnits <= 0) {
      context.addIssue({
        code: "custom",
        message: productFieldMessages.salePrice.NOT_POSITIVE ?? "",
      });
    }
  }),
  taxRate: z.enum(TAX_RATES),
});
type FormValues = z.infer<typeof formSchema>;

const isFieldName = (name: string): name is keyof FormValues =>
  (PRODUCT_FIELDS as readonly string[]).includes(name);

function NewProduct() {
  usePageTitle(productsMessages.newPageTitle);
  const navigate = useNavigate();
  const announce = useStatusAnnouncer();
  const createProduct = useCreateProduct();
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const alertRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { sku: "", name: "", unitOfMeasure: "", salePrice: "", taxRate: "GENERAL" },
  });
  const { setFocus } = form;

  // Focus starts on Código.
  useEffect(() => setFocus("sku"), [setFocus]);
  // After a form alert, focus goes to the alert.
  useEffect(() => {
    if (formError !== undefined) alertRef.current?.focus();
  }, [formError]);

  async function onSubmit(values: FormValues) {
    setFormError(undefined);
    const price = toMoney(values.salePrice, "USD");
    const unitOfMeasure = UNITS_OF_MEASURE.find((unit) => unit === values.unitOfMeasure);
    // The schema has already checked both; this only narrows the types.
    if (!price.ok || unitOfMeasure === undefined) return;

    const result = await createProduct.mutateAsync({
      sku: values.sku,
      name: values.name,
      unitOfMeasure,
      salePrice: { minorUnits: price.value.minorUnits, currency: "USD" },
      taxRate: values.taxRate,
    });

    if (result.ok) {
      announce(productsMessages.created(result.value.sku));
      await navigate({ to: "/productos", search: defaultProductsSearch });
      return;
    }

    const failure = result.error;
    if (failure.code === "SKU_ALREADY_EXISTS") {
      form.setError(
        "sku",
        {
          message: errorMessages.SKU_ALREADY_EXISTS({
            ...(failure.sku ? { sku: failure.sku } : {}),
          }),
        },
        { shouldFocus: true },
      );
      return;
    }
    if (failure.code === "VALIDATION_ERROR") {
      let focused = false;
      for (const issue of failure.issues ?? []) {
        const message = productFieldMessage(issue.field, issue.code);
        if (message === undefined || !isFieldName(issue.field)) continue;
        form.setError(issue.field, { message }, { shouldFocus: !focused });
        focused = true;
      }
      if (focused) return;
    }
    setFormError(errorMessages[failure.code]({}));
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-(--form-max-width) grid-cols-2 gap-4"
      >
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{productsMessages.form.sku}</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" aria-required="true" />
              </FormControl>
              <FormDescription>{productsMessages.form.skuHelp}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="unitOfMeasure"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{productsMessages.form.unitOfMeasure}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-required="true"
                    className="w-full"
                  >
                    <SelectValue placeholder={productsMessages.form.selectPlaceholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNITS_OF_MEASURE.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unitOfMeasureLabels[unit]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>{productsMessages.form.name}</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="off" aria-required="true" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="salePrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{productsMessages.form.salePrice}</FormLabel>
              <FormControl>
                <MoneyInput {...field} currency="USD" aria-required="true" />
              </FormControl>
              <FormDescription>{productsMessages.form.salePriceHelp}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="taxRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{productsMessages.form.taxRate}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-required="true"
                    className="w-full"
                  >
                    <SelectValue placeholder={productsMessages.form.selectPlaceholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TAX_RATES.map((rate) => (
                    <SelectItem key={rate} value={rate}>
                      {taxRateLabels[rate]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            className="col-span-2 block"
          >
            {formError}
          </Alert>
        )}

        <div className="col-span-2 flex gap-2">
          <Button type="submit" loading={createProduct.isPending}>
            {createProduct.isPending
              ? productsMessages.form.submitting
              : productsMessages.form.submit}
          </Button>
          <Button asChild variant="outline">
            <Link to="/productos" search={defaultProductsSearch}>
              {productsMessages.form.cancel}
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
