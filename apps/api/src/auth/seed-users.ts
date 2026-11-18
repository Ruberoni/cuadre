import { randomUUID } from "node:crypto";
import type { Role } from "@cuadre/contracts";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { accountsTable, usersTable } from "./auth.table.ts";
import type { Auth } from "./auth.ts";

/**
 * Test credentials for the fictitious seeded users, one per role (issue #10). Never a real
 * password: they only ever reach dev, test and e2e databases. Listed in AGENTS.md and `.env.example`.
 */
export const SEED_PASSWORD = "cuadre-demo-2026";

export const SEED_USERS: Readonly<Record<Role, { name: string; email: string }>> = {
  admin: { name: "María Fernández", email: "admin@cuadre.test" },
  sales: { name: "José Rodríguez", email: "ventas@cuadre.test" },
  purchasing: { name: "Carmen Pérez", email: "compras@cuadre.test" },
  warehouse: { name: "Luis González", email: "almacen@cuadre.test" },
};

/**
 * Creates the seeded users that are missing, each with its email + password account, in one
 * transaction per user (sign-up is closed, so this is the only way users appear). Safe to run again:
 * a user counts as present only with its password account, and a half-created one is replaced.
 */
export async function seedUsers(
  db: Db,
  auth: Auth,
  roles: readonly Role[] = Object.keys(SEED_USERS) as Role[],
): Promise<number> {
  const { password } = await auth.$context;
  let hash: string | undefined;
  let created = 0;
  for (const role of roles) {
    const { name, email } = SEED_USERS[role];
    const existing = await db
      .select({ id: usersTable.id, account: accountsTable.id })
      .from(usersTable)
      .leftJoin(
        accountsTable,
        and(eq(accountsTable.userId, usersTable.id), eq(accountsTable.providerId, "credential")),
      )
      .where(eq(usersTable.email, email));
    if (existing.some((row) => row.account !== null)) continue;

    // Hashing is slow on purpose: once per run, shared by the users it creates (all test values).
    hash ??= await password.hash(SEED_PASSWORD);
    const passwordHash = hash;
    await db.transaction(async (tx) => {
      await tx.delete(usersTable).where(eq(usersTable.email, email));
      const id = randomUUID();
      await tx.insert(usersTable).values({ id, name, email, role, emailVerified: true });
      await tx.insert(accountsTable).values({
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: passwordHash,
      });
    });
    created++;
  }
  return created;
}
