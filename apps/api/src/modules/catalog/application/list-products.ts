import { PRODUCTS_PAGE_SIZE, type ProductSortField } from "@cuadre/contracts";
import type { Product } from "../domain/product.ts";
import type { ProductRepository } from "./product-repository.ts";

export type ListProductsInput = {
  readonly q?: string | undefined;
  readonly sort: ProductSortField;
  readonly order: "asc" | "desc";
  readonly page: number;
};

export type ProductPage = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listProductsUseCase(
  products: ProductRepository,
  input: ListProductsInput,
): Promise<ProductPage> {
  const search = input.q?.trim();
  const { items, total } = await products.list({
    search: search === "" ? undefined : search,
    sort: input.sort,
    order: input.order,
    page: input.page,
    pageSize: PRODUCTS_PAGE_SIZE,
  });
  return { items, total, page: input.page, pageSize: PRODUCTS_PAGE_SIZE };
}
