import type { ProductField, ProductIssueCode } from "@cuadre/contracts";
import {
  err,
  type FieldIssue,
  invalid,
  type Money,
  money,
  ok,
  type Result,
  type ValidationFailure,
} from "@cuadre/shared-kernel";
import { type ProductName, parseProductName } from "./product-name.ts";
import { parseSku, type Sku } from "./sku.ts";
import { parseTaxRate, type TaxRate } from "./tax-rate.ts";
import { parseUnitOfMeasure, type UnitOfMeasure } from "./unit-of-measure.ts";

/** What a caller sends: untrusted text and numbers, checked by `createProduct`. */
export type ProductInput = {
  readonly sku: string;
  readonly name: string;
  readonly unitOfMeasure: string;
  readonly salePrice: { readonly minorUnits: number; readonly currency: string };
  readonly taxRate: string;
};

/** A valid product that has not been stored yet. The sale price is in USD, excluding IVA. */
export type NewProduct = {
  readonly sku: Sku;
  readonly name: ProductName;
  readonly unitOfMeasure: UnitOfMeasure;
  readonly salePrice: Money;
  readonly taxRate: TaxRate;
};

export type Product = NewProduct & { readonly id: string };

type ProductFieldIssue = FieldIssue<ProductField, ProductIssueCode>;
export type ProductValidationFailure = ValidationFailure<ProductField, ProductIssueCode>;

function parseSalePrice(price: ProductInput["salePrice"]): Result<Money, ProductIssueCode> {
  if (price.currency !== "USD") return err("INVALID");
  const amount = money(price.minorUnits, "USD");
  if (!amount.ok) return err(amount.error === "AMOUNT_OUT_OF_RANGE" ? "OUT_OF_RANGE" : "INVALID");
  if (amount.value.minorUnits <= 0) return err("NOT_POSITIVE");
  return amount;
}

/** Enforces every product rule and reports all the invalid fields at once. */
export function createProduct(
  input: ProductInput,
): { ok: true; value: NewProduct } | ProductValidationFailure {
  const sku = parseSku(input.sku);
  const name = parseProductName(input.name);
  const unitOfMeasure = parseUnitOfMeasure(input.unitOfMeasure);
  const salePrice = parseSalePrice(input.salePrice);
  const taxRate = parseTaxRate(input.taxRate);

  const issues: ProductFieldIssue[] = [];
  if (!sku.ok) issues.push({ field: "sku", code: sku.error });
  if (!name.ok) issues.push({ field: "name", code: name.error });
  if (!unitOfMeasure.ok) issues.push({ field: "unitOfMeasure", code: unitOfMeasure.error });
  if (!salePrice.ok) issues.push({ field: "salePrice", code: salePrice.error });
  if (!taxRate.ok) issues.push({ field: "taxRate", code: taxRate.error });

  // These checks are exactly `issues.length > 0`; spelled out so TypeScript narrows each result.
  if (!sku.ok || !name.ok || !unitOfMeasure.ok || !salePrice.ok || !taxRate.ok) {
    return invalid(issues);
  }
  return ok({
    sku: sku.value,
    name: name.value,
    unitOfMeasure: unitOfMeasure.value,
    salePrice: salePrice.value,
    taxRate: taxRate.value,
  });
}
