import { z } from "zod";

export const kardexSearchSchema = z.object({
  producto: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => (value === undefined || value.trim() === "" ? undefined : value)),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type KardexSearch = z.infer<typeof kardexSearchSchema>;

export const defaultKardexSearch: KardexSearch = {
  producto: undefined,
  page: 1,
};
