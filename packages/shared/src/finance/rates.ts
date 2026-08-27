// Exchange-rate shape + the pure conversion, shared by the rates endpoint, the
// SDK consumers and the front formatter.
//
// The table is always EUR-based because every amount we hold is EUR (see
// `currency.ts`). There is deliberately no built-in fallback table: an
// unreachable provider degrades to showing euros, never to a stale hardcoded
// rate — that is the bug this module exists to remove.

import { Region } from "@unicum.gg/wargaming";
import { BASE_CURRENCY, displayCurrency } from "./currency";

export type ExchangeRates = {
  /** Always `BASE_CURRENCY`; carried so a consumer never has to assume it. */
  base: string;
  /** ISO 4217 code -> how many units of it one euro buys. Includes the base at 1. */
  rates: Record<string, number>;
  /** When the provider was last read. */
  updatedAt: Date;
};

/** Just the lookup table, so a caller holding a payload whose `updatedAt` may
 * be null (no live rate) can still pass it straight through. */
export type RatesTable = Pick<ExchangeRates, "rates">;

/** How many units of `currency` one euro buys, or null when we cannot say. */
export function rateFromEur(
  currency: string,
  rates: RatesTable | null | undefined,
): number | null {
  if (currency === BASE_CURRENCY) return 1;
  const rate = rates?.rates[currency];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

/** A euro amount rendered in one currency, with the conversion baked in. */
export type MoneyFormatter = {
  /** Currency actually used — the base one when no rate was available. */
  currency: string;
  /** Whether the amount had to stay in euros for want of a rate. */
  converted: boolean;
  format: (eur: number, maximumFractionDigits?: number) => string;
};

/**
 * Formatter for a visitor on `region`, converting euro amounts at the live
 * rate. With no usable rate it falls back to euros rather than to a guess, so a
 * provider outage shows a correct amount in the wrong currency instead of a
 * wrong amount in the right one.
 */
export function moneyFormatter(
  region: Region,
  rates: RatesTable | null | undefined,
): MoneyFormatter {
  const wanted = displayCurrency(region);
  const rate = rateFromEur(wanted, rates);
  const currency = rate === null ? BASE_CURRENCY : wanted;
  const factor = rate ?? 1;
  // One formatter per precision, built lazily: these render inside tables where
  // `format` is called once per row.
  const formatters = new Map<number, Intl.NumberFormat>();
  const formatterFor = (digits: number) => {
    let fmt = formatters.get(digits);
    if (!fmt) {
      fmt = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: digits,
      });
      formatters.set(digits, fmt);
    }
    return fmt;
  };
  return {
    currency,
    converted: currency !== BASE_CURRENCY,
    format: (eur, maximumFractionDigits = 0) =>
      formatterFor(maximumFractionDigits).format(eur * factor),
  };
}
