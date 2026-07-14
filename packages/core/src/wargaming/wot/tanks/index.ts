import type { Region } from "@unicum.gg/wargaming";
import type { TankStats } from "@unicum.gg/shared";
import { wg } from "../../client";

// The `TankStats` shape is client-safe, so it lives in `@unicum.gg/shared`;
// re-exported here so `import { TankStats } from ".../wargaming/wot/tanks"`
// (alongside the fetchers) keeps working.
export type { TankStats } from "@unicum.gg/shared";

/** The per-tank fields this app surfaces (WN8/WNX inputs + mastery). */
const TANK_STATS_FIELDS = [
  "tank_id",
  "mark_of_mastery",
  "all.battles",
  "all.damage_dealt",
  "all.spotted",
  "all.frags",
  "all.dropped_capture_points",
  "all.wins",
  "all.radio_assisted_damage",
  "all.track_assisted_damage",
  "all.xp",
  "all.survived_battles",
  "all.hits",
  "all.shots",
  "all.piercings",
  "all.avg_damage_blocked",
] as const;

export const getTanksStats = (region: Region, accountId: number): Promise<TankStats[]> =>
  wg.region(region).api.wot.tanks.stats({ accountId, fields: TANK_STATS_FIELDS });

export const getTanksStatsBatch = (
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStats[]>> =>
  wg.region(region).api.wot.tanks.statsBatch({ accountIds, fields: TANK_STATS_FIELDS });
