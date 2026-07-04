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
