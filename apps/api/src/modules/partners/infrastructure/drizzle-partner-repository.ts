import { err, ok } from "@cuadre/shared-kernel";
import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "../../../db/client.ts";
import { postgresError, UNIQUE_VIOLATION } from "../../../db/postgres-error.ts";
import type { PartnerRepository, SupplierListParams } from "../application/partner-repository.ts";
import { type NewPartner, type Partner, reconstitutePartner } from "../domain/partner.ts";
import { partnersTable } from "./partners.table.ts";

type PartnerRow = typeof partnersTable.$inferSelect;

const RIF_UNIQUE_CONSTRAINT = "partners_rif_unique";

/** `%`, `_` and `\` are LIKE wildcards: searching for them must match them literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Rows are rebuilt through the domain rules, so a row that breaks them (edited by hand in the
 * database) fails loudly here instead of reaching the API.
 */
function toPartner(row: PartnerRow): Partner {
  const partner = reconstitutePartner({
    id: row.id,
    rif: row.rif,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    isSupplier: row.isSupplier,
    isCustomer: row.isCustomer,
  });
  if (!partner.ok) {
    throw new Error(`Partner ${row.id} in the database breaks the partner rules`);
  }
  return partner.value;
}

function orderBy(params: SupplierListParams): SQL[] {
  const direction = params.order === "asc" ? asc : desc;
  // `COLLATE "C"` makes the order of RIFs identical on every machine and database.
  const rifC = sql`${partnersTable.rif} collate "C"`;
  switch (params.sort) {
    case "rif":
      return [direction(rifC)];
    case "name":
      return [direction(partnersTable.name), asc(rifC)];
  }
}

export function createDrizzlePartnerRepository(db: Db): PartnerRepository {
  return {
    async insert(partner: NewPartner) {
      try {
        const [row] = await db
          .insert(partnersTable)
          .values({
            rif: partner.rif,
            name: partner.name,
            phone: partner.phone,
            email: partner.email,
            address: partner.address,
            isSupplier: partner.isSupplier,
            isCustomer: partner.isCustomer,
          })
          .returning();
        if (row === undefined) throw new Error("Insert returned no row");
        return ok(toPartner(row));
      } catch (error) {
        // Only the RIF's own unique index means "the RIF exists": another constraint is a bug.
        const { code, constraint } = postgresError(error);
        if (code === UNIQUE_VIOLATION && constraint === RIF_UNIQUE_CONSTRAINT) {
          return err("RIF_ALREADY_EXISTS");
        }
        throw error;
      }
    },

    async listSuppliers(params) {
      const pattern = params.search === undefined ? undefined : `%${escapeLike(params.search)}%`;
      const searchFilter =
        pattern === undefined
          ? undefined
          : or(ilike(partnersTable.rif, pattern), ilike(partnersTable.name, pattern));
      const where =
        searchFilter === undefined
          ? eq(partnersTable.isSupplier, true)
          : and(eq(partnersTable.isSupplier, true), searchFilter);

      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(partnersTable)
          .where(where)
          .orderBy(...orderBy(params))
          .limit(params.pageSize)
          .offset((params.page - 1) * params.pageSize),
        db.select({ total: count() }).from(partnersTable).where(where),
      ]);
      return { items: rows.map(toPartner), total: totals[0]?.total ?? 0 };
    },
  };
}
