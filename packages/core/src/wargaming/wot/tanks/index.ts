import type { Region } from "@unicum.gg/wargaming/region";
import { wg } from "../../client";

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

/** The curated per-tank shape the app consumes (a narrow slice of the WG response). */
export type TankStats = {
  tank_id: number;
  mark_of_mastery: number | null;
  // Marks of Excellence on the gun (0-3). Not part of the WG public API — merged
  // in from the WoT portal, so it is optional/absent on the raw API shape.
  marks_on_gun?: number | null;
  all: {
    battles: number;
    damage_dealt: number;
    spotted: number;
    frags: number;
    dropped_capture_points: number;
    wins: number;
    radio_assisted_damage: number;
    track_assisted_damage: number;
    xp: number;
    // Added for the per-tank server-average table. `piercings` and
    // `avg_damage_blocked` are optional in WG's response; the rest are always
    // present but may be absent on tanks with no random battles.
    survived_battles?: number;
    hits?: number;
    shots?: number;
    piercings?: number;
    avg_damage_blocked?: number;
  };
};

export const getTanksStats = (region: Region, accountId: number): Promise<TankStats[]> =>
  wg.region(region).api.wot.tanks.stats({ accountId, fields: TANK_STATS_FIELDS });

export const getTanksStatsBatch = (
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankStats[]>> =>
  wg.region(region).api.wot.tanks.statsBatch({ accountIds, fields: TANK_STATS_FIELDS });
