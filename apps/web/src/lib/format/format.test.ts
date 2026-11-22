import { describe, expect, it } from "vitest";
import {
  addDays,
  formatAmount,
  formatBcvRate,
  formatDate,
  formatMoney,
  formatRate,
  MAX_MINOR_UNITS,
  parseAmount,
  parseDate,
  parseRateInput,
  todayCaracas,
} from "./index.ts";

// The Design System puts a no-break space between the symbol and the amount.
const NBSP = " ";

describe("formatMoney", () => {
  it.each([
    [145, "USD", `$${NBSP}1,45`],
    [123456789, "VES", `Bs.${NBSP}1.234.567,89`],
    [0, "USD", `$${NBSP}0,00`],
    [5, "USD", `$${NBSP}0,05`],
    [123456, "USD", `$${NBSP}1.234,56`],
    [99999, "VES", `Bs.${NBSP}999,99`],
    [MAX_MINOR_UNITS, "USD", `$${NBSP}10.000.000.000.000,00`],
  ] as const)("%i minor units in %s → %s", (minor, currency, expected) => {
    expect(formatMoney(minor, currency)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, 2 ** 53, MAX_MINOR_UNITS + 1])(
    "rejects %s (outside 0..10^15)",
    (n) => {
      expect(() => formatMoney(n, "USD")).toThrow(RangeError);
    },
  );
});

describe("formatAmount", () => {
  it("has no symbol", () => {
    expect(formatAmount(123456)).toBe("1.234,56");
  });
});

describe("formatRate", () => {
  it.each([
    ["36.5123", "36,51230000"],
    ["36.51234567", "36,51234567"],
    ["36", "36,00000000"],
    ["1234.5", "1.234,50000000"],
    ["0.5", "0,50000000"],
  ])("%s → %s", (rate, expected) => {
    expect(formatRate(rate)).toBe(expected);
  });

  it.each(["36.123456789", "-1", "abc", "", "36,5", "036.5"])("rejects %j", (rate) => {
    expect(() => formatRate(rate)).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("2026-11-17 → 17/11/2026", () => {
    expect(formatDate("2026-11-17")).toBe("17/11/2026");
  });

  it("keeps the leading zeros of day and month", () => {
    expect(formatDate("2026-01-06")).toBe("06/01/2026");
  });

  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "17/11/2026", "2026-1-1"])(
    "rejects %s",
    (date) => {
      expect(() => formatDate(date)).toThrow(RangeError);
    },
  );
});

describe("parseAmount", () => {
  it.each([
    ["1,45", 145],
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234", 123400],
    ["0,5", 50],
    ["1.234", 123400],
    ["  1,45  ", 145],
    ["007,5", 750],
    ["10.000.000.000.000,00", MAX_MINOR_UNITS],
  ])("%j → %i", (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, value: expected });
  });

  it("accepts the symbol of the currency, with a normal or a no-break space", () => {
    expect(parseAmount(`$${NBSP}1.234,56`, "USD")).toEqual({ ok: true, value: 123456 });
    expect(parseAmount("Bs. 1,45", "VES")).toEqual({ ok: true, value: 145 });
    expect(parseAmount("$1,45")).toEqual({ ok: true, value: 145 });
  });

  it("rejects the symbol of another currency", () => {
    expect(parseAmount("$ 1,45", "VES")).toEqual({ ok: false, error: "WRONG_CURRENCY_SYMBOL" });
  });

  it("rejects more than 2 decimals instead of rounding", () => {
    expect(parseAmount("1,456")).toEqual({ ok: false, error: "TOO_MANY_DECIMALS" });
  });

  it.each([
    "abc",
    "",
    "   ",
    "-1",
    "1.23",
    "1,",
    ",5",
    "1,2,3",
    "1.2345",
    "1 000",
    "Bs.",
    "0.123,45",
    "000.000,00",
  ])("rejects %j as not a number", (input) => {
    expect(parseAmount(input)).toEqual({ ok: false, error: "NOT_A_NUMBER" });
  });

  it("rejects amounts above 10^15 minor units", () => {
    expect(parseAmount("10.000.000.000.000,01")).toEqual({ ok: false, error: "OUT_OF_RANGE" });
  });
});

describe("parseDate", () => {
  it.each([
    ["17/11/2026", "2026-11-17"],
    ["29/02/2028", "2028-02-29"],
    ["29/02/2000", "2000-02-29"],
    ["01/01/0001", "0001-01-01"],
    [" 06/01/2026 ", "2026-01-06"],
  ])("%j → %s", (input, expected) => {
    expect(parseDate(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["29/02/2026", "29/02/1900", "31/04/2026", "6/1/2026", "2026-11-17", "00/01/2026", ""])(
    "rejects %j",
    (input) => {
      expect(parseDate(input)).toEqual({ ok: false, error: "INVALID_DATE" });
    },
  );
});

describe("formatBcvRate", () => {
  it("prefixes Bs. and no-break space", () => {
    expect(formatBcvRate("36.5123")).toBe(`Bs.${NBSP}36,51230000`);
  });
});

describe("parseRateInput", () => {
  it.each([
    ["36,5123", "36.51230000"],
    ["1.234,5", "1234.50000000"],
    ["36", "36.00000000"],
    ["0,00000001", "0.00000001"],
    ["Bs. 36,51230000", "36.51230000"],
    [`Bs.${NBSP}36,5123`, "36.51230000"],
    ["999.999.999.999,99999999", "999999999999.99999999"],
  ])("%j → %s", (input, expected) => {
    expect(parseRateInput(input)).toEqual({ ok: true, value: expected });
  });

  it("rejects more than 8 decimals instead of rounding", () => {
    expect(parseRateInput("36,123456789")).toEqual({ ok: false, error: "TOO_MANY_DECIMALS" });
  });

  it.each(["0", "0,0", "0,00000000", "-1", "-36,5", "-0,00000001"])(
    "rejects %j as NOT_POSITIVE",
    (input) => {
      expect(parseRateInput(input)).toEqual({ ok: false, error: "NOT_POSITIVE" });
    },
  );

  it("rejects 13 integer digits as OUT_OF_RANGE", () => {
    expect(parseRateInput("1000000000000")).toEqual({ ok: false, error: "OUT_OF_RANGE" });
    expect(parseRateInput("1.000.000.000.000")).toEqual({ ok: false, error: "OUT_OF_RANGE" });
  });

  it.each(["", "   ", "abc", "36.5", "36,", ",5", "1 000", "Bs."])(
    "rejects %j as NOT_A_NUMBER",
    (input) => {
      expect(parseRateInput(input)).toEqual({ ok: false, error: "NOT_A_NUMBER" });
    },
  );
});

describe("todayCaracas and addDays", () => {
  it("computes UTC-4 calendar date", () => {
    expect(todayCaracas(new Date("2026-11-18T03:59:59Z"))).toBe("2026-11-17");
    expect(todayCaracas(new Date("2026-11-18T04:00:00Z"))).toBe("2026-11-18");
  });

  it("adds days across month/year boundaries", () => {
    expect(addDays("2026-11-17", 7)).toBe("2026-11-24");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
