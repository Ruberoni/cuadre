import type { ProductSortField } from "@cuadre/contracts";
import type { Result } from "@cuadre/shared-kernel";
import type { DbExecutor } from "../../../db/client.ts";
import type { NewProduct, Product } from "../domain/product.ts";

export type ProductListParams = {
  /** Matches the code or the name, case-insensitively. */
  readonly search: string | undefined;
  readonly sort: ProductSortField;
  readonly order: "asc" | "desc";
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
};

/** The port the use cases depend on; `infrastructure/` implements it. */
export type ProductRepository = {
  insert(product: NewProduct): Promise<Result<Product, "SKU_ALREADY_EXISTS">>;
  list(params: ProductListParams): Promise<{ items: Product[]; total: number }>;
  findByIds(ids: readonly string[], tx?: DbExecutor): Promise<Map<string, Product>>;
};
