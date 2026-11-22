import type { CalendarDate, Rate, Result } from "@cuadre/shared-kernel";
import type { DbExecutor, DbTransaction } from "../../../db/client.ts";
import type { ExchangeRateRecord } from "../domain/exchange-rate.ts";

export type ExchangeRateListResult = {
  items: ExchangeRateRecord[];
  total: number;
};

export type ExchangeRateRepository = {
  insert(rate: ExchangeRateRecord): Promise<Result<ExchangeRateRecord, "RATE_ALREADY_EXISTS">>;
  updateRate(
    date: CalendarDate,
    rate: Rate,
  ): Promise<Result<ExchangeRateRecord, "NOT_FOUND" | "RATE_ALREADY_FROZEN">>;
  list(params: { page: number; pageSize: number }): Promise<ExchangeRateListResult>;
  findLatestOnOrBefore(
    date: CalendarDate,
    tx?: DbExecutor,
  ): Promise<ExchangeRateRecord | undefined>;
  findAndFreezeLatestOnOrBefore(
    date: CalendarDate,
    tx: DbTransaction,
  ): Promise<ExchangeRateRecord | undefined>;
};
