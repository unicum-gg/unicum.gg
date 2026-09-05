import { db } from "@unicum.gg/core/db";
import { createRegionCache } from "@unicum.gg/core/lib/region-cache";
import { type TankMoe, moeByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

// The combined-damage thresholds for the three Marks of Excellence, keyed by
// tank id.
export type MoeValues = Pick<TankMoe, "mark1" | "mark2" | "mark3">;

// Static between the daily poliroid refreshes, ~1200 rows, and read by the
// player-detail endpoint as well as the /tanks pages. Without the cache every
// profile view would add a full scan of the region's table to the busiest
// endpoint we have, which is the position that made the specs catalogue the
// single heaviest read in prod (~104k scans in 7h).
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = createRegionCache(loadTankMoe, CACHE_TTL_MS);

async function loadTankMoe(region: Region): Promise<Map<number, MoeValues>> {
  const table = moeByRegion[region];
  const rows = await db
    .select({
      tankId: table.tankId,
      mark1: table.mark1,
      mark2: table.mark2,
      mark3: table.mark3,
    })
    .from(table);
  return new Map(
    rows.map((r) => [
      r.tankId,
      { mark1: r.mark1, mark2: r.mark2, mark3: r.mark3 },
    ]),
  );
}

/**
 * Every tank's Marks of Excellence thresholds for one region, keyed by tank id.
 * Powers the /tanks Marks of Excellence table and the profile's marks panel.
 * Reads our mirror table (refreshed daily by the moe cron), never the upstream
 * provider, so a poliroid outage can never break the page: a cold table just
 * yields an empty map and the cells render "—".
 *
 * Cached per region (see above); concurrent callers share the in-flight scan.
 */
export function getTankMoeByRegion(
  region: Region,
): Promise<Map<number, MoeValues>> {
  return cache.get(region);
}

/** Drop the cached thresholds so the next read reloads (called after a refresh,
 * so a daily poliroid sync is visible at once instead of after the TTL). */
export function invalidateTankMoeCache(region: Region): void {
  cache.invalidate(region);
}
