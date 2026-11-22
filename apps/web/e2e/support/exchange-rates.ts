import type { APIRequestContext } from "@playwright/test";
import { signInRequest } from "./auth.ts";
import { withE2eDatabase } from "./database.ts";
import { apiUrl } from "./products.ts";

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
  await withE2eDatabase(async (sql) => {
    await sql`update exchange_rates.rates set frozen = true where date = ${date}`;
  });
}
