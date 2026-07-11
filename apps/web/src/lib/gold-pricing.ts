// Real-money cost estimate for a tank, mirroring gunmarks.app: convert the
// WoT purchase/research values to gold, then price that gold against the EU
// store's gold bundles. The conversion between the two surrounding bundles is
// linear (with linear extrapolation past either end), so a 13,000-gold amount
// lands between the 12,500 and 15,000 bundles.

// EU store gold bundles as [gold, EUR]. Bulk bundles are cheaper per gold,
// which is why the estimate is non-linear. Update if WG re-prices the store.
const GOLD_BUNDLES: ReadonlyArray<readonly [gold: number, eur: number]> = [
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

// WoT exchange rates: 25 XP converts to 1 gold, 400 credits to 1 gold.
export const XP_PER_GOLD = 25;
export const CREDITS_PER_GOLD = 400;

/** Estimated euro price of an arbitrary gold amount, interpolated over the store bundles. */
export function goldToEuros(gold: number): number {
  const b = GOLD_BUNDLES;
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

export const eurosFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
