import type { Region } from "@unicum.gg/wargaming";
import { computeSpecRanges, type SpecRanges } from "@unicum.gg/shared";
import { cachedInRedis } from "@unicum.gg/core/redis";
import { getTankDataset } from "@unicum.gg/core/wargaming/wot/tanks/dataset";

// What a range is and how it is measured is client-safe and lives in shared;
// this module owns reading the catalogue and caching the result. Re-exported so
// the consumers that import `SpecRanges` from here keep resolving.
export * from "@unicum.gg/shared/wot/tanks/spec-ranges";

// A day: the catalogue only moves when the vehicles cron reparses the client
// mirror, and a range shifting by a fraction of a percent mid-day changes no
// displayed score.
const RANGES_TTL_SECONDS = 86_400;

/**
 * Where each specification sits across the whole vehicle catalogue, so a value
 * can be read as a position rather than a bare number ("2 400 DPM" means little
 * until you know the catalogue runs from 1 100 to 3 900).
 *
 * Region-scoped because the catalogue is (a vehicle can be missing on a server),
 * even though WG balances the values identically everywhere.
 */
export function getSpecRanges(region: Region): Promise<SpecRanges> {
  return cachedInRedis(`tanks:spec-ranges:${region}`, RANGES_TTL_SECONDS, () =>
    computeCatalogRanges(region),
  );
}

async function computeCatalogRanges(region: Region): Promise<SpecRanges> {
  const dataset = await getTankDataset(region);
  return computeSpecRanges(dataset.map((row) => row.specs));
}
