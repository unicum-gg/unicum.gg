import type { LoadoutMode, LoadoutRatings } from "../loadout-stats";

/**
 * What the recorded battles say about one map, one battle mode at a time.
 *
 * Wargaming publishes no per-arena record for anybody, and a player's own
 * statistics carry no map at all, so every figure here exists because the
 * unicum.gg mod uploads each battle its player fights, with all thirty
 * vehicles in it. That second half is what makes a map answerable: one upload
 * is a whole battle, so the sample grows by thirty vehicle records at a time
 * rather than by one player.
 *
 * ## Two units, and they are not interchangeable
 *
 * A BATTLE is the unit of everything that happens once per game: how long it
 * lasted, how it ended, which spawn won. A VEHICLE RECORD is one account's
 * part in one battle, and is the unit of everything about how a class, a tier
 * or a tank does there. The second is thirty times the first, which is why the
 * spawn balance needs far more battles than the class table before it says
 * anything, and why each block states its own sample.
 *
 * ## Read against the same vehicles elsewhere
 *
 * A class's damage on a map is mostly the damage of the vehicles that happen
 * to be played there, so a figure alone says little. Every group carries a
 * baseline: the SAME vehicles, weighted the same way, over every map of the
 * mode. The difference is then about the map rather than about which tanks
 * the matchmaker sent to it.
 *
 * Bots are left out (a record with no account), and a mode's figures are never
 * pooled with another's, for the reasons `LoadoutMode` gives.
 */

/**
 * How a battle ended, by the game's own `FINISH_REASON`.
 *
 * Only the three a random battle can end on are named: everything else (a
 * technical stop, the Onslaught and event-specific endings) is folded into
 * `Other` rather than published as a code nobody can read.
 */
export enum MapFinishReason {
  /** One team destroyed. */
  Extermination = "extermination",
  /** A base captured. */
  Base = "base",
  /** The clock ran out. */
  Timeout = "timeout",
  Other = "other",
}

/** The game's own `FINISH_REASON` values each named ending is read from. */
const FINISH_REASON_CODES: Record<number, MapFinishReason> = {
  1: MapFinishReason.Extermination,
  2: MapFinishReason.Base,
  3: MapFinishReason.Timeout,
};

export function mapFinishReasonOf(code: number | null): MapFinishReason {
  return (code != null && FINISH_REASON_CODES[code]) || MapFinishReason.Other;
}

/**
 * Battles a spawn comparison needs before it is read as a percentage.
 *
 * Below it the page writes "4 of 9" rather than "44%": a spawn split is a
 * coin flip per battle, and at a dozen battles a 60/40 split is well within
 * what a fair map produces by chance. Like `CONFIDENT_LOADOUT_SAMPLE` it is a
 * reading aid and deliberately round, not a confidence interval.
 */
export const CONFIDENT_SPAWN_SAMPLE = 50;

/** How the vehicle records behind one row went. */
export interface MapRecordStats {
  /** Different accounts among them. */
  players: number;
  /** Vehicle records: one account's part in one battle. */
  records: number;
  /** Records on the winning side over records, 0..1. A draw is not a win. */
  winrate: number | null;
  avgDamage: number | null;
  /** Spotting plus tracking assistance, per record. */
  avgAssist: number | null;
  avgKills: number | null;
  avgSpotted: number | null;
  /** Records still alive when the battle ended, over records, 0..1. */
  survival: number | null;
  avgXp: number | null;
}

/**
 * The averages a row is read against: the same vehicles over every map of the
 * mode, each weighted by how many records it has on THIS map. Null where none
 * of them was seen anywhere else, which cannot happen with the map's own
 * records included and is kept for honesty rather than for a real case.
 */
export type MapRecordBaseline = Pick<
  MapRecordStats,
  | "winrate"
  | "avgDamage"
  | "avgAssist"
  | "avgKills"
  | "avgSpotted"
  | "survival"
  | "avgXp"
>;

/** One vehicle class, or one tier, on this map. */
export interface MapGroupStats {
  /** The class (`heavyTank`, `AT-SPG`...) or the tier as a string. */
  key: string;
  stats: MapRecordStats;
  baseline: MapRecordBaseline;
}

/** What a page needs to draw and link a vehicle without the catalogue. */
export interface MapTankVehicle {
  slug: string | null;
  name: string;
  shortName: string;
  tag: string;
  type: string;
  tier: number;
  nation: string;
  /** The game's role (`HT_assault`...), what the catalogue's role filter reads. */
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
}

/** One vehicle on this map. */
export interface MapTankStats {
  tankId: number;
  /** Null for a vehicle the catalogue does not know yet. */
  vehicle: MapTankVehicle | null;
  stats: MapRecordStats;
  /** The ratings over its records here, with the site's own formulas. */
  rating: LoadoutRatings;
  /** The same vehicle's ratings over every map of the mode. */
  baselineRating: LoadoutRatings;
}

/** One way a battle ended, and how often. */
export interface MapFinishCount {
  reason: MapFinishReason;
  battles: number;
}

/** Which side won, counted per battle. */
export interface MapSpawnBalance {
  /** Battles the first team (the game's team 1, spawning at base 1) won. */
  team1: number;
  team2: number;
  draws: number;
}

/** Every mode's own sample, so a caller can pick one that holds something. */
export interface MapModeSample {
  mode: LoadoutMode;
  battles: number;
}

export interface MapStatistics {
  arenaId: string;
  mode: LoadoutMode;
  modes: MapModeSample[];
  /** Battles counted in this mode. */
  battles: number;
  /** Different accounts across them. */
  players: number;
  /** Vehicle records across them, which every group is counted over. */
  records: number;
  /** Seconds, over the battles that report one. */
  avgDuration: number | null;
  finish: MapFinishCount[];
  spawns: MapSpawnBalance;
  classes: MapGroupStats[];
  tiers: MapGroupStats[];
  tanks: MapTankStats[];
  /** Newest battle counted. */
  updatedAt: Date | null;
}
