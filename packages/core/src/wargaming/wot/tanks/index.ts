import type { Region } from "@unicum.gg/wargaming";
import type { TankStats } from "@unicum.gg/shared";
import { wg } from "../../client";

// The `TankStats` shape is client-safe, so it lives in `@unicum.gg/shared`;
// re-exported here so `import { TankStats } from ".../wargaming/wot/tanks"`
// (alongside the fetchers) keeps working.
export type { TankStats } from "@unicum.gg/shared";

/**
 * The per-tank fields this app surfaces: the WN8/WNX inputs, mastery, and the
 * rest of the in-game vehicle record (Service Record → Statistics).
 *
 * Asking for more costs nothing beyond a slightly larger response: it is the
 * same call, and `tanks/stats` is the expensive one (it does not batch, so it
 * is already one request per account).
 */
const TANK_STATS_FIELDS = [
  "tank_id",
  "mark_of_mastery",
  // Top level, beside `tank_id`: the docs put the vehicle's personal bests
  // outside the per-mode blocks, and `all.max_xp` is rejected outright. The
  // mode sections carry a `max_damage` the top level has no equivalent for,
  // but they answer 0 for every tank of every account tried, so the game's
  // third record line has no source here.
  "max_xp",
  "max_frags",
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
  "all.damage_received",
  "all.capture_points",
  "all.stun_number",
  "all.stun_assisted_damage",
  "all.tanking_factor",
] as const;

export const getTanksStats = (region: Region, accountId: number): Promise<TankStats[]> =>
  wg.region(region).api.wot.tanks.stats({ accountId, fields: TANK_STATS_FIELDS });

export const getTanksStatsBatch = (
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStats[]>> =>
  wg.region(region).api.wot.tanks.statsBatch({ accountIds, fields: TANK_STATS_FIELDS });
