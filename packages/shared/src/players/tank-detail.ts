import type { RatingHistoryPoint } from "./rating-history";
import type { TankStats } from "../wot/tank-stats";
import type { VehicleMeta } from "../wot/tanks/meta";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";

/**
 * One player's record on one vehicle, the way the game's own Service Record
 * shows it, plus the three ratings the game has no notion of.
 *
 * Every number here is derived from the player's latest per-tank snapshot, so
 * the whole thing carries one `updatedAt`: it is a photograph of a career on a
 * tank, not a live counter.
 *
 * A field is null when the underlying counter is: the columns behind the damage
 * ratio, the stuns and the armour figures were added to the snapshot table after
 * the fact and backfill as the pipeline rewrites each player, so an account that
 * has not been refreshed since renders those rows as dashes and the rest in
 * full.
 */
export type PlayerTankDetail = {
  tankId: number;
  slug: string | null;
  name: string;
  shortName: string | null;
  tier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  /** When the snapshot these numbers come from was taken. */
  updatedAt: string;

  battles: number;
  /** Mark of Mastery (0-4) and Marks of Excellence on the gun (0-3). */
  mom: number | null;
  moe: number | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;

  /** The game's "General Parameters", as ratios in 0..1 where it shows a
   * percentage, so the formatting stays with the component. */
  winrate: number;
  survivalRate: number | null;
  hitRate: number | null;
  /** Damage dealt over damage taken. */
  damageRatio: number | null;
  /** Frags over deaths. Null on a tank never lost, where it is not a ratio. */
  destructionRatio: number | null;
  /** Wargaming's own armour use factor, reported rather than derived. */
  armorUseEfficiency: number | null;
  stuns: number | null;

  /** The game's "Average Score per Battle". */
  avgXp: number | null;
  avgDamage: number;
  avgDamageReceived: number | null;
  avgAssist: number;
  avgAssistRadio: number;
  avgAssistTrack: number;
  avgAssistStun: number | null;
  avgBlocked: number | null;
  avgSpotted: number;
  avgFrags: number;
  avgCapture: number | null;
  avgDefense: number;
  avgStuns: number | null;

  /** The game's "Record Score", minus the maximum damage it also shows:
   * Wargaming reports no per-tank equivalent. */
  maxXp: number | null;
  maxFrags: number | null;
};

/** Per-battle average, or null when the counter behind it was never stored. */
function avg(total: number | null | undefined, battles: number): number | null {
  return total == null ? null : total / battles;
}

/**
 * The detail for one vehicle, from the same `TankStats` shape the rest of the
 * player surfaces are built from.
 *
 * Returns null on a vehicle with no battles: the game does not list it either,
 * and every figure below would be a division by zero.
 */
export function buildPlayerTankDetail(
  tank: TankStats,
  meta: VehicleMeta | null,
  slug: string | null,
  updatedAt: Date,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): PlayerTankDetail | null {
  const a = tank.all;
  const battles = a.battles;
  if (battles <= 0) return null;

  const deaths = a.survived_battles == null ? null : battles - a.survived_battles;
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  // Assistance is the sum the game shows on one line; the three sources are
  // kept beside it because which one a tank earns says what it was played as.
  const assistStun = a.stun_assisted_damage ?? null;
  const assist =
    a.radio_assisted_damage + a.track_assisted_damage + (assistStun ?? 0);

  return {
    tankId: tank.tank_id,
    slug,
    name: meta?.name ?? "",
    shortName: meta?.shortName ?? null,
    tier: meta?.tier ?? null,
    nation: meta?.nation ?? null,
    type: meta?.type ?? null,
    role: meta?.role ?? null,
    isPremium: meta?.isPremium ?? false,
    isReward: meta?.isReward ?? false,
    updatedAt: updatedAt.toISOString(),

    battles,
    mom: tank.mark_of_mastery ?? null,
    moe: tank.marks_on_gun ?? null,
    wn7: computeWN7(
      {
        battles,
        wins: a.wins,
        frags: a.frags,
        damageDealt: a.damage_dealt,
        spotted: a.spotted,
        droppedCapturePoints: a.dropped_capture_points,
      },
      meta?.tier ?? null,
    ),
    wn8: computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback),
    wnx: computeWNX([tank], wnxExpected),

    winrate: a.wins / battles,
    survivalRate: avg(a.survived_battles, battles),
    hitRate: a.shots ? (a.hits ?? 0) / a.shots : null,
    damageRatio: a.damage_received ? a.damage_dealt / a.damage_received : null,
    destructionRatio: deaths ? a.frags / deaths : null,
    armorUseEfficiency: a.tanking_factor ?? null,
    stuns: a.stun_number ?? null,

    // A tank with battles always earned xp, so a zero means the column was
    // never written rather than a career without a single point.
    avgXp: a.xp > 0 ? a.xp / battles : null,
    avgDamage: a.damage_dealt / battles,
    avgDamageReceived: avg(a.damage_received, battles),
    avgAssist: assist / battles,
    avgAssistRadio: a.radio_assisted_damage / battles,
    avgAssistTrack: a.track_assisted_damage / battles,
    avgAssistStun: avg(assistStun, battles),
    avgBlocked: avg(
      a.avg_damage_blocked == null ? null : a.avg_damage_blocked * battles,
      battles,
    ),
    avgSpotted: a.spotted / battles,
    avgFrags: a.frags / battles,
    avgCapture: avg(a.capture_points, battles),
    avgDefense: a.dropped_capture_points / battles,
    avgStuns: avg(a.stun_number, battles),

    maxXp: tank.max_xp ?? null,
    maxFrags: tank.max_frags ?? null,
  };
}

/**
 * The record as the vehicle panel serves it: the snapshot above, plus the
 * series charted beside it. One payload, so the panel arrives complete rather
 * than filling in from a second round trip.
 */
export type PlayerTankRecord = PlayerTankDetail & {
  /** Both curves for this vehicle, over the same 90 days as the profile's. */
  ratingHistory: RatingHistoryPoint[];
};
