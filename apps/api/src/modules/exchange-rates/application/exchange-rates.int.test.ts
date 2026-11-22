import { addDays, type CalendarDate, rateToString } from "@cuadre/shared-kernel";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createExchangeRatesModule } from "../index.ts";
import { createDrizzleExchangeRateRepository } from "../infrastructure/drizzle-exchange-rate-repository.ts";
import { seedExchangeRates } from "../infrastructure/seed-exchange-rates.ts";
import { correctExchangeRateUseCase } from "./correct-exchange-rate.ts";
import { listExchangeRatesUseCase } from "./list-exchange-rates.ts";
import {
  lookupAndFreezeExchangeRateUseCase,
  lookupExchangeRateUseCase,
} from "./lookup-exchange-rate.ts";
import { recordExchangeRateUseCase } from "./record-exchange-rate.ts";

const { db, close } = createDb(testDatabaseUrl());
const rates = createDrizzleExchangeRateRepository(db);
const today = "2026-11-17" as CalendarDate;

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("recordExchangeRateUseCase", () => {
  it("stores a rate normalised to 8 decimals and unfrozen", async () => {
    const res = await recordExchangeRateUseCase(
      rates,
      { date: "2026-11-17", rate: "36.5123" },
      today,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.date).toBe("2026-11-17");
    expect(rateToString(res.value.rate)).toBe("36.51230000");
    expect(res.value.frozen).toBe(false);
  });

  it("fails with RATE_ALREADY_EXISTS when a date is recorded twice", async () => {
    await recordExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5123" }, today);
    const second = await recordExchangeRateUseCase(
      rates,
      { date: "2026-11-17", rate: "36.6" },
      today,
    );
    expect(second).toEqual({ ok: false, error: "RATE_ALREADY_EXISTS", date: "2026-11-17" });
  });

  it("creates the same date only once when requests race", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        recordExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5123" }, today),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "RATE_ALREADY_EXISTS")).toHaveLength(4);
  });

  it("accepts up to +7 days ahead and rejects +8 days with RATE_DATE_TOO_FAR", async () => {
    const plus7 = await recordExchangeRateUseCase(
      rates,
      { date: "2026-11-24", rate: "36.5" },
      today,
    );
    expect(plus7.ok).toBe(true);

    const plus8 = await recordExchangeRateUseCase(
      rates,
      { date: "2026-11-25", rate: "36.5" },
      today,
    );
    expect(plus8).toEqual({ ok: false, error: "RATE_DATE_TOO_FAR", date: "2026-11-25" });
  });

  it("reports validation issues without touching the database", async () => {
    const res = await recordExchangeRateUseCase(
      rates,
      { date: "2026-02-30", rate: "36.123456789" },
      today,
    );
    expect(res).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "date", code: "INVALID_DATE" },
        { field: "rate", code: "TOO_MANY_DECIMALS" },
      ],
    });
    expect((await listExchangeRatesUseCase(rates, { page: 1 })).total).toBe(0);
  });
});

describe("listExchangeRatesUseCase", () => {
  it("orders by date descending and pages by 25", async () => {
    for (let i = 0; i < 30; i++) {
      await recordExchangeRateUseCase(
        rates,
        {
          date: addDays("2026-10-01" as CalendarDate, i),
          rate: `36.${String(i).padStart(2, "0")}`,
        },
        today,
      );
    }

    const first = await listExchangeRatesUseCase(rates, { page: 1 });
    const second = await listExchangeRatesUseCase(rates, { page: 2 });

    expect(first.total).toBe(30);
    expect(first.items).toHaveLength(25);
    expect(first.items[0]?.date).toBe("2026-10-30");
    expect(first.items[24]?.date).toBe("2026-10-06");
    expect(second.items.map((item) => item.date)).toEqual([
      "2026-10-05",
      "2026-10-04",
      "2026-10-03",
      "2026-10-02",
      "2026-10-01",
    ]);
  });
});

describe("lookup, freeze, and correct", () => {
  it("looks up the latest rate on or before the target date, or MISSING_EXCHANGE_RATE", async () => {
    await recordExchangeRateUseCase(rates, { date: "2026-11-14", rate: "36.4" }, today);
    await recordExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5123" }, today);

    const sun = await lookupExchangeRateUseCase(rates, "2026-11-16");
    expect(sun.ok && rateToString(sun.value.rate)).toBe("36.40000000");

    const mon = await lookupExchangeRateUseCase(rates, "2026-11-17");
    expect(mon.ok && rateToString(mon.value.rate)).toBe("36.51230000");

    expect(await lookupExchangeRateUseCase(rates, "2026-11-13")).toEqual({
      ok: false,
      error: "MISSING_EXCHANGE_RATE",
    });
  });

  it("corrects an unfrozen rate and refuses correcting a frozen rate with RATE_ALREADY_FROZEN", async () => {
    await recordExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5123" }, today);

    const updated = await correctExchangeRateUseCase(rates, {
      date: "2026-11-17",
      rate: "36.52",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(rateToString(updated.value.rate)).toBe("36.52000000");

    await db.transaction(async (tx) => {
      const frozen = await lookupAndFreezeExchangeRateUseCase(rates, "2026-11-17", tx);
      expect(frozen.ok && frozen.value.frozen).toBe(true);
    });

    const rejected = await correctExchangeRateUseCase(rates, {
      date: "2026-11-17",
      rate: "36.55",
    });
    expect(rejected).toEqual({
      ok: false,
      error: "RATE_ALREADY_FROZEN",
      date: "2026-11-17",
    });

    const after = await lookupExchangeRateUseCase(rates, "2026-11-17");
    expect(after.ok && rateToString(after.value.rate)).toBe("36.52000000");
  });

  it("returns NOT_FOUND when correcting an unrecorded date", async () => {
    expect(await correctExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5" })).toEqual({
      ok: false,
      error: "NOT_FOUND",
      date: "2026-11-17",
    });
  });

  it("rolls back the freeze when the caller transaction aborts (ADR-008)", async () => {
    await recordExchangeRateUseCase(rates, { date: "2026-11-17", rate: "36.5123" }, today);
    const mod = createExchangeRatesModule({ db, today: () => today });

    await expect(
      db.transaction(async (tx) => {
        const res = await mod.lookupAndFreezeForDate("2026-11-17", tx);
        expect(res.ok && res.value.frozen).toBe(true);
        const insideTx = await mod.lookupForDate("2026-11-17", tx);
        expect(insideTx.ok && insideTx.value.frozen).toBe(true);
        throw new Error("abort document issue");
      }),
    ).rejects.toThrow("abort document issue");

    const afterRollback = await mod.lookupForDate("2026-11-17");
    expect(afterRollback.ok && afterRollback.value.frozen).toBe(false);
  });
});

describe("seedExchangeRates", () => {
  it("loads 5 rates and is idempotent on repeat runs", async () => {
    const first = await seedExchangeRates(rates, today);
    const second = await seedExchangeRates(rates, today);

    expect(first).toBe(5);
    expect(second).toBe(0);
    expect((await listExchangeRatesUseCase(rates, { page: 1 })).total).toBe(5);
  });
});
