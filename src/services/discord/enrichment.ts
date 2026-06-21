import type { TankSnapshot } from "@/services/db/schema";
import { loadPlayerInitialData } from "@/services/players/initial-data";
import { enqueuePlayerRefreshBackground } from "@/services/players/refresh-queue";
import type { Region } from "@/services/wargaming/wot";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";

// Same priority a profile page hit uses when it warms a cold account, so a
// Discord lookup and a web visit compete fairly in the refresh queue.
const ON_DEMAND_PRIORITY = 10;

export type TopTank = {
  name: string;
  tier: number;
  battles: number;
  winRate: number;
};

export type StatCardEnrichment = {
  wn8: number | null;
  wnx: number | null;
  battles30d: number | null;
  wn830d: number | null;
  topTank: TopTank | null;
};

/**
 * Loads the same DB-backed cached ratings the profile page and opengraph-image
 * render: headline WN8 / WNX, 30d recent battles, and the most-played tank.
 * Best-effort by design: returns null when the account is not tracked yet so
 * the caller falls back to the live-only card, and in that case warms the cache
 * by enqueuing an on-demand refresh at the same priority a page hit uses.
 */
export async function loadStatCardEnrichment(
  region: Region,
  accountId: number,
): Promise<StatCardEnrichment | null> {
  const initial = await loadPlayerInitialData(region, { accountId });
  const player = initial.player;

  if (!player) {
    enqueuePlayerRefreshBackground(region, [accountId], {
      priority: ON_DEMAND_PRIORITY,
    });
    return null;
  }

  // Ratings can lag the row on a freshly discovered account (the snapshot cron
  // computes WN8/WNX after the first crawl). Nudge a refresh so the next lookup
  // is fully enriched, but still return whatever we have now.
  if (player.wn8 === null || player.wnx === null) {
    enqueuePlayerRefreshBackground(region, [accountId], {
      priority: ON_DEMAND_PRIORITY,
    });
  }

  return {
    wn8: player.wn8,
    wnx: player.wnx,
    battles30d: player.battles30d,
    wn830d: player.wn830d,
    topTank: await resolveTopTank(region, initial.latestTankSnapshots),
  };
}

/**
 * Picks the most-played tank from the latest per-tank snapshots and resolves
 * its display name + tier from the vehicle encyclopedia. Returns null for
 * accounts with no recorded tank battles (fresh or unseen accounts).
 */
async function resolveTopTank(
  region: Region,
  tanks: TankSnapshot[],
): Promise<TopTank | null> {
  let best: TankSnapshot | null = null;
  for (const t of tanks) {
    if (!best || t.battles > best.battles) best = t;
  }
  if (!best || best.battles <= 0) return null;

  const encyclopedia = await getVehicleEncyclopedia(region);
  const meta = encyclopedia[String(best.tankId)];
  return {
    name: meta?.name ?? `Tank #${best.tankId}`,
    tier: meta?.tier ?? 0,
    battles: best.battles,
    winRate: best.wins / best.battles,
  };
}
