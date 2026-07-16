// Real-money cost estimate for a tank, mirroring gunmarks.app: convert the
// WoT purchase/research values to gold, then price that gold against the
// region's store gold bundles (see `@/constants/shop`). The conversion
// between the two surrounding bundles is linear (with linear extrapolation past
// either end), so a 13,000-gold amount lands between the 12,500 and 15,000
// bundles.

import type { Region } from "@unicum.gg/wargaming";
import GOLD_PRICING, {
  type RegionGoldPricing,
} from "@/constants/shop";

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

function interpolate(
  b: RegionGoldPricing["bundles"],
  gold: number,
): number {
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
