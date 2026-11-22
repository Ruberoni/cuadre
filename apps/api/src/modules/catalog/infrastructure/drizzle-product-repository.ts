import { err, ok } from "@cuadre/shared-kernel";
import { asc, count, desc, ilike, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../../../db/client.ts";
import { postgresError, UNIQUE_VIOLATION } from "../../../db/postgres-error.ts";
import type { ProductListParams, ProductRepository } from "../application/product-repository.ts";
import { createProduct, type NewProduct, type Product } from "../domain/product.ts";
import { productsTable } from "./products.table.ts";

type ProductRow = typeof productsTable.$inferSelect;

const SKU_UNIQUE_CONSTRAINT = "products_sku_unique";

/** `%`, `_` and `\` are LIKE wildcards: searching for them must match them literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Rows are rebuilt through the domain rules, so a row that breaks them (edited by hand in the
 * database) fails loudly here instead of reaching the API.
 */
function toProduct(row: ProductRow): Product {
  const product = createProduct({
    sku: row.sku,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    salePrice: { minorUnits: row.salePriceMinor, currency: row.salePriceCurrency },
    taxRate: row.taxRate,
  });
  if (!product.ok) {
    throw new Error(`Product ${row.id} in the database breaks the product rules`);
  }
  return { id: row.id, ...product.value };
}

function orderBy(params: ProductListParams): SQL[] {
  const direction = params.order === "asc" ? asc : desc;
  // `COLLATE "C"` makes the order of codes identical on every machine and database.
  const skuC = sql`${productsTable.sku} collate "C"`;
  switch (params.sort) {
    case "sku":
      return [direction(skuC)];
    case "name":
      return [direction(productsTable.name), asc(skuC)];
    case "salePrice":
      return [direction(productsTable.salePriceMinor), asc(skuC)];
  }
}

export function createDrizzleProductRepository(db: Db): ProductRepository {
  return {
    async insert(product: NewProduct) {
      try {
        const [row] = await db
          .insert(productsTable)
          .values({
            sku: product.sku,
            name: product.name,
            unitOfMeasure: product.unitOfMeasure,
            salePriceMinor: product.salePrice.minorUnits,
            salePriceCurrency: "USD",
            taxRate: product.taxRate,
          })
          .returning();
        if (row === undefined) throw new Error("Insert returned no row");
        return ok(toProduct(row));
      } catch (error) {
        // Only the code's own unique index means "the code exists": another constraint is a bug.
        const { code, constraint } = postgresError(error);
        if (code === UNIQUE_VIOLATION && constraint === SKU_UNIQUE_CONSTRAINT) {
          return err("SKU_ALREADY_EXISTS");
        }
        throw error;
      }
    },

    async list(params) {
      const pattern = params.search === undefined ? undefined : `%${escapeLike(params.search)}%`;
      const where =
        pattern === undefined
          ? undefined
          : or(ilike(productsTable.sku, pattern), ilike(productsTable.name, pattern));

      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(productsTable)
          .where(where)
          .orderBy(...orderBy(params))
          .limit(params.pageSize)
          .offset((params.page - 1) * params.pageSize),
        db.select({ total: count() }).from(productsTable).where(where),
      ]);
      return { items: rows.map(toProduct), total: totals[0]?.total ?? 0 };
    },
  };
}
