import type { PlayerAchievement } from "./achievements";
import type { RatingHistoryPoint } from "./rating-history";
import type { TankStats } from "../wot/tank-stats";
import { isRatedTankMode, type TankBattleMode } from "../wot/tank-modes";
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
 * Everything a vehicle record derives from ONE battle-mode block.
 *
 * Split out from the record below because the same derivation serves two
 * readers: the `all` block, which is what the page has always shown, and each
 * per-mode block beside it. Nothing here names the vehicle or the player, so a
 * record can carry one of these per mode without repeating the metadata eleven
 * times on the wire.
 */
export type TankRecordStats = {
  battles: number;
  /** Null outside Random Battles: the expected values behind all three are
   * measured on random battles and mean nothing elsewhere. See
   * `TANK_MODES_RATED`. */
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

  /** The game's "Record Score". */
  maxXp: number | null;
  maxFrags: number | null;
  /**
   * The best single battle's damage.
   *
   * Null on the overall record and on Random Battles, where Wargaming reports
   * no figure (the top level has no such field and the `random` and `clan`
   * blocks answer 0 for every vehicle of every account measured). Real on every
   * other mode, which is the only place the game's third record line has a
   * source at all.
   */
  maxDamage: number | null;
};

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
export type PlayerTankDetail = TankRecordStats & {
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

  /** Mark of Mastery (0-4) and Marks of Excellence on the gun (0-3). None of
   * the three is reported per mode: a mark is on the gun, not on a format, and
   * the bar it is scored against is a rolling window of random battles. */
  mom: number | null;
  moe: number | null;
  /**
   * Progress towards the next mark of excellence, 0 to 100 with two decimals.
   *
   * Null for every account that does not run the mod: this number lives only
   * in the client's own vehicle dossier, so neither the public API nor the
   * portal can supply it. Where it is null the site still shows its own
   * estimate, derived from average damage against the mark thresholds.
   */
  moePercent: number | null;
};

/** Per-battle average, or null when the counter behind it was never stored. */
function avg(total: number | null | undefined, battles: number): number | null {
  return total == null ? null : total / battles;
}

/**
 * The block a record is derived from.
 *
 * `TankStats["all"]`, a mode block Wargaming sent, and the Random block derived
 * by subtracting the other two parts of `all` all fit: the derivation only ever
 * reads counters the three have in common, which is why the derived one can
 * stand in for a fetched one despite the snapshot table never having stored a
 * win/loss/draw split.
 */
export type TankRecordBlock = TankStats["all"] & {
  max_damage?: number;
  max_xp?: number;
  max_frags?: number;
};

/** Where the record scores live. Wargaming puts the overall ones at the top
 * level, beside `tank_id`, and each mode's inside its own block. */
type RecordScores = {
  max_xp?: number | null;
  max_frags?: number | null;
  max_damage?: number | null;
};

/**
 * The derived figures for one battle-mode block, or null when it holds no
 * battles (the game lists no such record either, and every figure below would
 * be a division by zero).
 *
 * `rated` decides whether the three WN ratings are computed at all. They are
 * built against expected values measured on random battles, so outside Random
 * they answer a question nobody asked and answer it wrongly: see
 * `TANK_MODES_RATED`. Null here rather than a number nobody should read, which
 * is also what lets the garage table drop the column instead of dashing it.
 */
export function buildTankRecordStats(
  tankId: number,
  block: TankRecordBlock,
  scores: RecordScores,
  tier: number | null,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  wn8Fallback: Map<string, WN8Expected>,
  rated = true,
): TankRecordStats | null {
  const battles = block.battles;
  if (battles <= 0) return null;

  const deaths =
    block.survived_battles == null ? null : battles - block.survived_battles;
  // The two rating helpers read a whole row rather than a block, so the mode's
  // counters are handed over as one: the vehicle is the same vehicle, and the
  // expected values are keyed on it.
  const asRow: TankStats = { tank_id: tankId, mark_of_mastery: null, all: block };
  // Assistance is the sum the game shows on one line; the three sources are
  // kept beside it because which one a tank earns says what it was played as.
  const assistStun = block.stun_assisted_damage ?? null;
  const assist =
    block.radio_assisted_damage + block.track_assisted_damage + (assistStun ?? 0);

  return {
    battles,
    wn7: rated
      ? computeWN7(
          {
            battles,
            wins: block.wins,
            frags: block.frags,
            damageDealt: block.damage_dealt,
            spotted: block.spotted,
            droppedCapturePoints: block.dropped_capture_points,
          },
          tier,
        )
      : null,
    wn8: rated ? computeWN8([asRow], wn8Expected, encyclopedia, wn8Fallback) : null,
    wnx: rated ? computeWNX([asRow], wnxExpected) : null,

    winrate: block.wins / battles,
    survivalRate: avg(block.survived_battles, battles),
    hitRate: block.shots ? (block.hits ?? 0) / block.shots : null,
    damageRatio: block.damage_received
      ? block.damage_dealt / block.damage_received
      : null,
    destructionRatio: deaths ? block.frags / deaths : null,
    armorUseEfficiency: block.tanking_factor ?? null,
    stuns: block.stun_number ?? null,

    // A tank with battles always earned xp, so a zero means the column was
    // never written rather than a career without a single point.
    avgXp: block.xp > 0 ? block.xp / battles : null,
    avgDamage: block.damage_dealt / battles,
    avgDamageReceived: avg(block.damage_received, battles),
    avgAssist: assist / battles,
    avgAssistRadio: block.radio_assisted_damage / battles,
    avgAssistTrack: block.track_assisted_damage / battles,
    avgAssistStun: avg(assistStun, battles),
    avgBlocked: avg(
      block.avg_damage_blocked == null
        ? null
        : block.avg_damage_blocked * battles,
      battles,
    ),
    avgSpotted: block.spotted / battles,
    avgFrags: block.frags / battles,
    avgCapture: avg(block.capture_points, battles),
    avgDefense: block.dropped_capture_points / battles,
    avgStuns: avg(block.stun_number, battles),

    maxXp: scores.max_xp ?? null,
    maxFrags: scores.max_frags ?? null,
    // Zero is Wargaming saying it does not report one for this mode, not a
    // career without a damaging battle: a vehicle with battles always dealt
    // damage in at least one of them.
    maxDamage: scores.max_damage ? scores.max_damage : null,
  };
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
  const stats = buildTankRecordStats(
    tank.tank_id,
    tank.all,
    // The overall block reports no best-damage line, so the record carries two
    // of the game's three. See `TankRecordStats.maxDamage`.
    { max_xp: tank.max_xp, max_frags: tank.max_frags },
    meta?.tier ?? null,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    buildWN8Fallback(wn8Expected, encyclopedia),
  );
  if (!stats) return null;

  return {
    ...stats,
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
    mom: tank.mark_of_mastery ?? null,
    moe: tank.marks_on_gun ?? null,
    moePercent: tank.mark_percent ?? null,
  };
}

/**
 * One mode's slice of a vehicle record.
 *
 * The flags ride the entry rather than being looked up by the component,
 * because what they say is about the DATA and a reader has to be told: a
 * retired mode's record can only ever shrink, and a multi-vehicle mode's
 * battles are counted once per vehicle fielded, so they must not be summed into
 * a total. See `TANK_MODES_MULTI_VEHICLE`.
 */
export type PlayerTankModeRecord = TankRecordStats & {
  mode: TankBattleMode;
  /** No longer played, so these numbers are an archive. */
  retired: boolean;
  /** One battle counted against several vehicles. Never sum these. */
  multiVehicle: boolean;
};

/** A mode block plus which mode it is, as the readers hand it over. */
export type TankModeBlock = {
  mode: TankBattleMode;
  stats: TankRecordBlock;
  retired: boolean;
  multiVehicle: boolean;
};

/**
 * The per-mode slices of a vehicle record, in the order they were given.
 *
 * A mode with no battles is dropped rather than carried as zeroes: the point of
 * the breakdown is where a player actually took the tank, and eleven empty rows
 * on the overwhelming majority of vehicles would bury the one or two that are
 * not.
 */
export function buildPlayerTankModeRecords(
  tankId: number,
  blocks: TankModeBlock[],
  tier: number | null,
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
): PlayerTankModeRecord[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const out: PlayerTankModeRecord[] = [];
  for (const block of blocks) {
    const stats = buildTankRecordStats(
      tankId,
      block.stats,
      block.stats,
      tier,
      encyclopedia,
      wn8Expected,
      wnxExpected,
      wn8Fallback,
      isRatedTankMode(block.mode),
    );
    if (!stats) continue;
    out.push({
      ...stats,
      mode: block.mode,
      retired: block.retired,
      multiVehicle: block.multiVehicle,
    });
  }
  return out;
}

/**
 * The record as the vehicle panel serves it: the snapshot above, plus the two
 * things rendered beside it. One payload, so the panel arrives complete rather
 * than filling in from three round trips.
 */
export type PlayerTankRecord = PlayerTankDetail & {
  /** Both curves for this vehicle, over the same 90 days as the profile's. */
  ratingHistory: RatingHistoryPoint[];
  /** The medals earned on it, in the game's cabinet order. Earned only, and
   * null when they are not known yet (a player nothing has been fetched for),
   * which renders as no section rather than as an empty one. */
  awards: PlayerAchievement[] | null;
  /**
   * Where those battles were fought, newest reading first in mode order.
   *
   * Empty on a vehicle only ever taken into Random Battles, which is most of
   * them, and empty too for a player whose record predates the breakdown being
   * collected: it fills in on their next refresh rather than being backfilled,
   * since Wargaming reports lifetime totals and there is nothing historical to
   * recover.
   */
  modes: PlayerTankModeRecord[];
};
