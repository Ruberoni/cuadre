import { PRODUCT_SORT_FIELDS } from "@cuadre/contracts";
import { z } from "zod";

// Every param falls back to its default, so a hand-edited URL never breaks the page.
export const productsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(PRODUCT_SORT_FIELDS).catch("sku"),
  order: z.enum(["asc", "desc"]).catch("asc"),
  page: z.number().int().min(1).catch(1),
});

export type ProductsSearch = z.output<typeof productsSearchSchema>;

/** The list as it opens: by code, first page, no search. Links to the list pass it explicitly. */
export const defaultProductsSearch = {
  sort: "sku",
  order: "asc",
  page: 1,
} as const satisfies ProductsSearch;
