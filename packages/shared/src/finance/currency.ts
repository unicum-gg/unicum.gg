// Which currency our own money is shown in, and how it is formatted.
//
// Everything we hold is denominated in euros: the host invoices us in EUR and
// Stripe collects pledges in EUR. Nothing is ever stored converted — conversion
// happens once, at display, against a live rate. A hardcoded rate is what made
// every figure on /support and /coverage wrong.
//
// There is no per-user currency picker: a region already implies a currency on
// this site, so the funding and cost figures follow the exact same mapping the
// tank/account value estimates use rather than inventing a second one.

import { REGIONS, Region } from "@unicum.gg/wargaming";
import { storeCurrency } from "../shop";

/** ISO 4217 code every amount we store is denominated in. */
export const BASE_CURRENCY = "EUR";

/**
 * Currency to show our figures in for a visitor on `region` — the same one
 * that region's WoT store bills in (EU: EUR, NA: USD, Asia: SGD), so a player
 * reads our costs in the currency they already buy gold with. Falls back to the
 * base currency for a region with no store table.
 */
export function displayCurrency(region: Region): string {
  return storeCurrency(region) ?? BASE_CURRENCY;
}

/**
 * Every currency the site can display, derived from the per-region store tables
 * rather than listed by hand: pricing a new region automatically extends the
 * set of rates we fetch. Used to keep the rates payload to what we render.
 */
export const DISPLAY_CURRENCIES: readonly string[] = [
  ...new Set([BASE_CURRENCY, ...REGIONS.map(displayCurrency)]),
];
