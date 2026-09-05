import { db } from "@unicum.gg/core/db";
import { createRegionCache } from "@unicum.gg/core/lib/region-cache";
import { type TankMom, momByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

// The XP thresholds for the four Mark of Mastery badges, keyed by tank id.
export type MomValues = Pick<TankMom, "class3" | "class2" | "class1" | "ace">;

// Same shape and the same reason as the Marks of Excellence thresholds beside
// it, minus the profile: this one is read by the /tanks dataset and the per-tank
// page, both of which were paying a full table scan per call.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = createRegionCache(loadTankMom, CACHE_TTL_MS);

async function loadTankMom(region: Region): Promise<Map<number, MomValues>> {
  const table = momByRegion[region];
  const rows = await db
    .select({
      tankId: table.tankId,
      class3: table.class3,
      class2: table.class2,
      class1: table.class1,
      ace: table.ace,
    })
    .from(table);
  return new Map(
    rows.map((r) => [
      r.tankId,
      { class3: r.class3, class2: r.class2, class1: r.class1, ace: r.ace },
    ]),
  );
}

/**
 * Every tank's Mark of Mastery thresholds for one region, keyed by tank id.
 * Powers the /tanks Marks of Mastery table and the per-tank page. Reads our
 * mirror table (refreshed daily by the mastery cron), never the upstream
 * provider, so a poliroid outage can never break the page: a cold table just
 * yields an empty map and the cells render "—".
 *
 * Cached per region (see above); concurrent callers share the in-flight scan.
 */
export function getTankMomByRegion(
  region: Region,
): Promise<Map<number, MomValues>> {
  return cache.get(region);
}

/** Drop the cached thresholds so the next read reloads (called after a refresh,
 * so a daily poliroid sync is visible at once instead of after the TTL). */
export function invalidateTankMomCache(region: Region): void {
  cache.invalidate(region);
}
