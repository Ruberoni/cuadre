import { type Currency, err, type Money, money, ok, type Result } from "@cuadre/shared-kernel";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { currencySymbol, formatAmount, type ParseAmountError, parseAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The typed text as `Money`, or why it is not an amount. Never goes through a float. */
export function toMoney(text: string, currency: Currency): Result<Money, ParseAmountError> {
  const minorUnits = parseAmount(text, currency);
  if (!minorUnits.ok) return err(minorUnits.error);
  const amount = money(minorUnits.value, currency);
  return amount.ok ? ok(amount.value) : err("OUT_OF_RANGE");
}

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "value" | "onChange"
> & {
  currency: Currency;
  /** What the user typed, as is. */
  value: string;
  onChange: (text: string) => void;
};

/**
 * Amount in one currency, typed the Venezuelan way (`1.234,56`). Letters are not accepted as typed; the symbol sits outside the editable text; on blur a
 * valid amount is reformatted (`1234,5` → `1.234,50`). More than two decimals is the form's error
 * to show, never silently rounded.
 */
export function MoneyInput({
  currency,
  value,
  onChange,
  onBlur,
  className,
  ...props
}: MoneyInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-muted-foreground"
      >
        {currencySymbol(currency)}
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={(event) => {
          const parsed = parseAmount(value, currency);
          if (parsed.ok) onChange(formatAmount(parsed.value));
          onBlur?.(event);
        }}
        className={cn("tabular-nums", currency === "USD" ? "pl-7" : "pl-10", className)}
      />
    </div>
  );
}
