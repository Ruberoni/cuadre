import { z } from "zod";

export const goodsReceiptsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export type GoodsReceiptsSearch = z.infer<typeof goodsReceiptsSearchSchema>;

export const defaultGoodsReceiptsSearch: GoodsReceiptsSearch = {
  page: 1,
};

export const newGoodsReceiptSearchSchema = z.object({
  orden: z.string().optional().catch(undefined),
});
