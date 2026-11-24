import { z } from "zod";

export const purchaseOrdersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export type PurchaseOrdersSearch = z.infer<typeof purchaseOrdersSearchSchema>;

export const defaultPurchaseOrdersSearch: PurchaseOrdersSearch = {
  page: 1,
};
