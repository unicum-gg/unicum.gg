import type { Region } from "@unicum.gg/wargaming";
import { cachedInRedis } from "@unicum.gg/core/redis";
import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";

/** The catalogue's spread on one specification, as the 5th and 95th percentile
 * of every vehicle that has a value for it. */
export type SpecRange = { low: number; high: number };

/** Every quantified specification, keyed by its `TankSpec` field name. */
export type SpecRanges = Record<string, SpecRange>;

// A day: the catalogue only moves when the vehicles cron reparses the client
// mirror, and a range shifting by a fraction of a percent mid-day changes no
// displayed score.
const RANGES_TTL_SECONDS = 86_400;

// Identity and bookkeeping columns are numbers too, but they are not
// characteristics — no vehicle is "better" for having a higher id. Everything
// else numeric is quantified, so a specification added to the catalogue is
// scored without touching this file; a consumer reads the fields it displays
// and ignores the rest.
const NOT_A_CHARACTERISTIC = new Set(["tankId", "totalFreeXp"]);

/** Linear-interpolated quantile of an ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Where each specification sits across the whole vehicle catalogue, so a value
 * can be read as a position rather than a bare number ("2 400 DPM" means little
 * until you know the catalogue runs from 1 100 to 3 900).
 *
 * The bounds are the 5th and 95th percentile rather than the min and max: a
 * single 1 750-alpha derp gun would otherwise flatten every other vehicle's
 * damage into the bottom fifth of the scale. Values outside them are clamped by
 * the consumer, so the extremes read as "at the top of the catalogue" instead of
 * stretching it.
 *
 * Region-scoped because the catalogue is (a vehicle can be missing on a server),
 * even though WG balances the values identically everywhere.
 */
export function getSpecRanges(region: Region): Promise<SpecRanges> {
  return cachedInRedis(`tanks:spec-ranges:${region}`, RANGES_TTL_SECONDS, () =>
    computeSpecRanges(region),
  );
}

async function computeSpecRanges(region: Region): Promise<SpecRanges> {
  const dataset = await getTankDataset(region);
  const values = new Map<string, number[]>();
  for (const row of dataset) {
    if (!row.specs) continue;
    for (const [key, value] of Object.entries(row.specs)) {
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
    // A specification every vehicle shares the value of (or that only a handful
    // carry) has no spread to normalise against; skipping it keeps it out of the
    // scores rather than having it read as a flat 0 or 100 for everyone.
    if (!(high > low)) continue;
    out[key] = { low, high };
  }
  return out;
}
