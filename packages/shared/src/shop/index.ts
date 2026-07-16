// WoT store gold-bundle prices per region, plus the money conversion, for the
// tank real-money cost estimate and the account-valuation model. Client-safe
// and pure (no DB / WG), so it lives in shared and is used by the web front,
// the API valuation, and the bot alike.
//
// Prices are per-region because WG charges different currencies and amounts on
// EU / NA / Asia. Each table is captured from that region's store
// (`https://wargaming.net/shop/wot/gold/any_amount_gold/`, which geo-routes to
// the visitor's realm). Update a table if WG re-prices that region's store.

import { Region } from "@unicum.gg/wargaming";

/** A region's store gold bundles as [gold, price] in `currency`. Bulk bundles
 * are cheaper per gold, which is why the estimate is non-linear. */
export type RegionGoldPricing = {
  /** ISO 4217 currency the store bills in. */
  currency: string;
  bundles: ReadonlyArray<readonly [gold: number, price: number]>;
};

// WoT exchange rates (identical across regions): 25 XP → 1 gold, 400 credits → 1 gold.
export const XP_PER_GOLD = 25;
export const CREDITS_PER_GOLD = 400;

// EU store (EUR), captured 2026-07-16 and re-verified against the live shop GraphQL.
const EU_BUNDLES: RegionGoldPricing["bundles"] = [
  [500, 2.25],
  [2500, 9.95],
  [5000, 18.87],
  [7500, 27.43],
  [10000, 35.78],
  [12500, 43.97],
  [15000, 52.04],
  [17500, 60],
  [20000, 67.87],
  [22500, 75.67],
  [25000, 83.4],
  [30000, 98.7],
  [35000, 115.15],
  [40000, 131.6],
  [45000, 148.05],
  [50000, 164.5],
  [55000, 180.94],
];

// NA store (USD), captured 2026-07-16. The US "any amount" gold purchase caps
// at 25,000 per transaction, so the table ends there; larger amounts extrapolate
// along the last segment's slope like every other out-of-range value.
const NA_BUNDLES: RegionGoldPricing["bundles"] = [
  [500, 2.97],
  [2500, 12.63],
  [5000, 23.56],
  [7500, 33.92],
  [10000, 43.93],
  [12500, 53.69],
  [15000, 63.25],
  [17500, 72.65],
  [20000, 81.92],
  [22500, 91.07],
  [25000, 100.12],
];

// Asia store (SGD, Singapore realm), captured 2026-07-16 from its "any amount"
// gold product (`ps_p_1285_web`), sampled on the same grid as EU.
const ASIA_BUNDLES: RegionGoldPricing["bundles"] = [
  [500, 3.06],
  [2500, 14.81],
  [5000, 28.89],
  [7500, 42.71],
  [10000, 56.35],
  [12500, 69.87],
  [15000, 83.29],
  [17500, 96.63],
  [20000, 109.9],
  [22500, 123.11],
  [25000, 136],
  [30000, 163.2],
  [35000, 190.4],
  [40000, 217.6],
  [45000, 244.8],
  [50000, 272],
  [55000, 299.2],
];

/**
 * Per-region store pricing. Callers hide the money estimate for a region with
 * no table rather than mispricing it in the wrong currency.
 */
export const GOLD_PRICING: Record<Region, RegionGoldPricing | null> = {
  [Region.EU]: { currency: "EUR", bundles: EU_BUNDLES },
  [Region.NA]: { currency: "USD", bundles: NA_BUNDLES },
  [Region.ASIA]: { currency: "SGD", bundles: ASIA_BUNDLES },
};

function interpolate(b: RegionGoldPricing["bundles"], gold: number): number {
  for (let i = 0; i < b.length - 1; i++) {
    const [g0, e0] = b[i];
    const [g1, e1] = b[i + 1];
    if (gold >= g0 && gold <= g1) return e0 + ((e1 - e0) * (gold - g0)) / (g1 - g0);
  }
  // Below the smallest bundle: extrapolate along the first segment's slope.
  if (gold < b[0][0]) {
    const [g0, e0] = b[0];
    const [g1, e1] = b[1];
    return e0 + ((e1 - e0) / (g1 - g0)) * (gold - g0);
  }
  // Above the largest bundle: extrapolate along the last segment's slope.
  const [g0, e0] = b[b.length - 2];
  const [g1, e1] = b[b.length - 1];
  return e1 + ((e1 - e0) / (g1 - g0)) * (gold - g1);
}

/** Estimated store price of a gold amount for a region, or null if that region
 * has no bundle table yet. Interpolated over the bundles, extrapolated past the
 * ends along the nearest segment's slope. */
export function goldToMoney(
  region: Region,
  gold: number,
): { amount: number; currency: string } | null {
  const pricing = GOLD_PRICING[region];
  if (!pricing) return null;
  return { amount: interpolate(pricing.bundles, gold), currency: pricing.currency };
}

/** ISO 4217 currency a region's store bills in, or null if unpriced. */
export function storeCurrency(region: Region): string | null {
  return GOLD_PRICING[region]?.currency ?? null;
}

/** Currency formatter for a region's store currency (or null if none). */
export function moneyFmt(region: Region): Intl.NumberFormat | null {
  const pricing = GOLD_PRICING[region];
  if (!pricing) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: pricing.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
