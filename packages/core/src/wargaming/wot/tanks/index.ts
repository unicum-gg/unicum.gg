import type { Region } from "@unicum.gg/wargaming";
import { TankStatsExtra } from "@unicum.gg/wargaming";
import { TANK_MODES_STORED, type TankStatsWithModes } from "@unicum.gg/shared";
import { wg } from "../../client";

// The `TankStats` shape is client-safe, so it lives in `@unicum.gg/shared`;
// re-exported here so `import { TankStats } from ".../wargaming/wot/tanks"`
// (alongside the fetchers) keeps working.
export type { TankStats, TankStatsWithModes } from "@unicum.gg/shared";

/**
 * The extras among the mode blocks.
 *
 * `clan`, `company`, `globalmap`, both Stronghold blocks and the two team ones
 * come back on every call, zeroed on a vehicle the mode was never played in.
 * The other three have to be asked for, and answer `null` rather than zeroes
 * when they hold nothing.
 */
const MODE_EXTRAS = [
  TankStatsExtra.Epic,
  TankStatsExtra.Fallout,
  TankStatsExtra.Ranked10x10,
] as const;

/**
 * The per-tank fields this app surfaces: the WN8/WNX inputs, mastery, the rest
 * of the in-game vehicle record (Service Record → Statistics), and the record
 * in each battle mode beside it.
 *
 * The mode blocks are asked for WHOLE rather than by dotted leaf, and that is
 * forced: Wargaming refuses a `fields` list of more than 100 entries
 * (`FIELDS_LIST_LIMIT_EXCEEDED`), and naming the counters of ten modes one by
 * one is 180. Thirty-three whole blocks is well inside it, and the cost is
 * bearable because the response is gzipped: measured on a 320-vehicle account,
 * 19 KB on the wire against 135 KB uncompressed for the narrow list, so 2.4x
 * where the decoded body is 14x, and `JSON.parse` of the whole 1.9 MB is 3 ms.
 * What it buys back is every counter each mode reports rather than a subset
 * chosen to fit a budget.
 */
const TANK_STATS_FIELDS = [
  "tank_id",
  "mark_of_mastery",
  // Top level, beside `tank_id`: the docs put the vehicle's personal bests
  // outside the per-mode blocks, and `all.max_xp` is rejected outright. The
  // mode sections carry a `max_damage` the top level has no equivalent for,
  // which is 0 on `random` and `clan` and real on every other mode, so the
  // game's third record line has a source per mode and none overall.
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
  ...TANK_MODES_STORED,
] as const;

export const getTanksStats = (
  region: Region,
  accountId: number,
): Promise<TankStatsWithModes[]> =>
  wg
    .region(region)
    .api.wot.tanks.stats({ accountId, fields: TANK_STATS_FIELDS, extra: MODE_EXTRAS });

export const getTanksStatsBatch = (
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStatsWithModes[]>> =>
  wg
    .region(region)
    .api.wot.tanks.statsBatch({ accountIds, fields: TANK_STATS_FIELDS, extra: MODE_EXTRAS });
