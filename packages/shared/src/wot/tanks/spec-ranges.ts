/**
 * Where a characteristic's values sit across a set of vehicles, so a bare
 * number can be read as a position ("2 400 DPM" means little until you know the
 * set runs from 1 100 to 3 900).
 *
 * The pure half of the measurement: core owns fetching the catalogue and
 * caching the result, this owns what a range is and how it is computed, so the
 * same code measures the whole catalogue and one tier of it.
 */

/** One characteristic's spread, as the 5th and 95th percentile of the vehicles
 * that have a value for it. */
export type SpecRange = { low: number; high: number };

/** Every quantified characteristic, keyed by its `TankSpec` field name. */
export type SpecRanges = Record<string, SpecRange>;

/**
 * Identity and bookkeeping columns are numbers too, but they are not
 * characteristics: no vehicle is "better", or even different in any readable
 * way, for having a higher id. Everything else numeric is measured, so a
 * characteristic added to the catalogue is covered without touching this file.
 */
const NOT_A_CHARACTERISTIC = new Set(["tankId", "totalFreeXp"]);

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * The spread of every characteristic across a set of vehicles.
 *
 * The bounds are the 5th and 95th percentile rather than the min and max: a
 * single 1 750-alpha derp gun would otherwise flatten every other vehicle's
 * damage into the bottom fifth of the scale. Values outside them are clamped by
 * the consumer, so the extremes read as "at the top of the set" instead of
 * stretching it.
 *
 * A characteristic every vehicle shares the value of (or that only a handful
 * carry) has no spread to normalise against, so it is left out rather than
 * reading as a flat 0 or 100 for everyone.
 */
export function computeSpecRanges(
  rows: (Record<string, unknown> | null)[],
): SpecRanges {
  const values = new Map<string, number[]>();
  for (const row of rows) {
    if (!row) continue;
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (NOT_A_CHARACTERISTIC.has(key)) continue;
      const list = values.get(key);
      if (list) list.push(value);
      else values.set(key, [value]);
    }
  }

  const out: SpecRanges = {};
  for (const [key, list] of values) {
    if (list.length === 0) continue;
    list.sort((a, b) => a - b);
    const low = quantile(list, 0.05);
    const high = quantile(list, 0.95);
    if (!(high > low)) continue;
    out[key] = { low, high };
  }
  return out;
}

/**
 * How far along a range a value sits, 0 to 1, clamped to the measured band.
 *
 * No sense of "better" here, only of position: that is the difference between
 * scoring a vehicle (where a low reload is good) and comparing two (where a low
 * reload is simply what this tank has, and the question is whether the other one
 * has it too).
 */
export function normalizeSpec(value: number, range: SpecRange): number {
  const t = (value - range.low) / (range.high - range.low);
  return Math.min(1, Math.max(0, t));
}
