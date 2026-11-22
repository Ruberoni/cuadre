import { SUPPLIER_SORT_FIELDS } from "@cuadre/contracts";
import { z } from "zod";

// Every param falls back to its default, so a hand-edited URL never breaks the page.
export const suppliersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(SUPPLIER_SORT_FIELDS).catch("name"),
  order: z.enum(["asc", "desc"]).catch("asc"),
  page: z.number().int().min(1).catch(1),
});

export type SuppliersSearch = z.output<typeof suppliersSearchSchema>;

/** The list as it opens: by legal name, first page, no search. Links to the list pass it explicitly. */
export const defaultSuppliersSearch = {
  sort: "name",
  order: "asc",
  page: 1,
} as const satisfies SuppliersSearch;
