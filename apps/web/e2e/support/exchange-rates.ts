import type { APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { signInRequest } from "./auth.ts";
import { apiUrl } from "./products.ts";

const databaseUrl =
  process.env.DATABASE_URL_E2E ?? "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";

/** Records an exchange rate through the API as the seeded admin. */
export async function givenExchangeRate(
  request: APIRequestContext,
  input: { date: string; rate: string },
): Promise<void> {
  await signInRequest(request, apiUrl);
  const response = await request.post(`${apiUrl}/api/exchange-rates`, {
    data: input,
  });
  if (!response.ok()) {
    throw new Error(`Could not record rate for ${input.date}: ${response.status()}`);
  }
}

/** Marks a rate frozen directly in `cuadre_e2e` (simulating an issued document until #14+ exist). */
export async function freezeExchangeRate(date: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`update exchange_rates.rates set frozen = true where date = ${date}`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
