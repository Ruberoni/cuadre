import { EXCHANGE_RATES_PAGE_SIZE } from "@cuadre/contracts";
import type { ExchangeRateRecord } from "../domain/exchange-rate.ts";
import type { ExchangeRateRepository } from "./exchange-rate-repository.ts";

export type ExchangeRatesPage = {
  items: ExchangeRateRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listExchangeRatesUseCase(
  rates: ExchangeRateRepository,
  query: { page: number },
): Promise<ExchangeRatesPage> {
  const { items, total } = await rates.list({
    page: query.page,
    pageSize: EXCHANGE_RATES_PAGE_SIZE,
  });
  return { items, total, page: query.page, pageSize: EXCHANGE_RATES_PAGE_SIZE };
}
