/**
 * Battle-weighted average. Used for clan aggregate ratings (WNX, WN8,
 * winrate) where the simple arithmetic mean is misleading: a member with
 * 1 battle at 100% winrate would otherwise count as much as a 50k-battle
 * veteran.
 *
 * Returns null when no point carries positive weight, so callers can
 * distinguish "empty clan" from a legit 0.
 */
export type WeightedDataPoint = { value: number; weight: number };

export function weightedAverage(
  points: WeightedDataPoint[],
): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { value, weight } of points) {
    if (weight <= 0) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Linear-interpolated quantile of an ASCENDING array.
 *
 * Sorted input rather than sorted here, because the callers that measure a
 * spread ask for several quantiles of the same sample (the tank spec ranges
 * take two per characteristic across the whole catalogue) and would otherwise
 * sort it again for each one. `median` below is the convenience for the callers
 * that hold one unordered sample and want its middle.
 */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * The middle of an unordered sample, null when there is nothing to measure.
 *
 * The median rather than the mean wherever a distribution has one long tail and
 * no other, which is every figure the Onslaught board is read for: a handful of
 * accounts sit far above the field on rating, and a handful grind several
 * hundred battles where most need a hundred. A mean reports those few and calls
 * them typical.
 *
 * Null on an empty sample, so a caller can tell "nobody to measure" from a
 * legitimate zero.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5);
}
