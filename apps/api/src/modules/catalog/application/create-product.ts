import {
  createProduct,
  type Product,
  type ProductInput,
  type ProductValidationFailure,
} from "../domain/product.ts";
import type { ProductRepository } from "./product-repository.ts";

/** A failed result of the same shape as `Result` (ADR-009); the duplicate also names the code. */
export type CreateProductResult =
  | { ok: true; value: Product }
  | { ok: false; error: "SKU_ALREADY_EXISTS"; sku: string }
  | ProductValidationFailure;

export async function createProductUseCase(
  products: ProductRepository,
  input: ProductInput,
): Promise<CreateProductResult> {
  const product = createProduct(input);
  if (!product.ok) return product;
  const stored = await products.insert(product.value);
  if (stored.ok) return stored;
  return { ok: false, error: stored.error, sku: product.value.sku };
}
