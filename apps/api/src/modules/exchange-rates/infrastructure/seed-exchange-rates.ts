import type { ExchangeRateRepository } from "../application/exchange-rate-repository.ts";
import { recordExchangeRateUseCase } from "../application/record-exchange-rate.ts";
import { addDays, type CalendarDate } from "../domain/calendar-date.ts";

/** Five recent daily BCV rates up to `today`, oldest to newest. */
const SAMPLE_RATES: readonly [daysAgo: number, rate: string][] = [
  [4, "36.38000000"],
  [3, "36.42500000"],
  [2, "36.45000000"],
  [1, "36.48750000"],
  [0, "36.51230000"],
];

/**
 * Loads fictitious demo BCV rates through the same use case as the API, so they obey every rule.
 * A date that already exists is skipped, making repeated runs idempotent.
 */
export async function seedExchangeRates(
  rates: ExchangeRateRepository,
  today: CalendarDate,
): Promise<number> {
  let created = 0;
  for (const [daysAgo, rate] of SAMPLE_RATES) {
    const date = addDays(today, -daysAgo);
    const result = await recordExchangeRateUseCase(rates, { date, rate }, today);
    if (result.ok) created++;
    else if (result.error !== "RATE_ALREADY_EXISTS") {
      throw new Error(`Seed exchange rate ${date} is invalid: ${JSON.stringify(result)}`);
    }
  }
  return created;
}
