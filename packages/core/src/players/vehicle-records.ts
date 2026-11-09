import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  TankBattleMode,
  tankModesByRegion,
  tankSnapshotsByRegion,
  wn7AccAdd,
  wn7AccZero,
  wn7Finalize,
  wn8AccAdd,
  wn8AccZero,
  wn8Finalize,
  wnxAccAdd,
  wnxAccZero,
  wnxFinalize,
  type WN8Expected,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import { getPlayerIdsByAccounts } from ".";

/** One (account, vehicle) a caller is asking about. */
export type VehiclePair = { accountId: number; tankId: number };

/**
 * What the figures in a record cover.
 *
 * `mode` is the mode that was asked for. `overall` is the vehicle's whole
 * record, every mode together, which is what a reader gets when the mode asked
 * for is one Wargaming publishes nothing about: Frontline, Onslaught and Steel
 * Hunter have no per-vehicle block at all (see `TankBattleMode`), and a figure
 * silently covering the wrong battles would be worse than a wider one that says
 * how wide it is.
 */
export type VehicleRecordScope = "mode" | "overall";

/** One player's record on one vehicle, over one mode or over all of them. */
export type VehicleRecord = {
  accountId: number;
  tankId: number;
  scope: VehicleRecordScope;
  /** The mode these figures cover, or null when they cover every mode. */
  mode: TankBattleMode | null;
  battles: number;
  /** Percent, like every win rate the API serves. */
  winrate: number | null;
  avgDamage: number | null;
  avgXp: number | null;
  /** Percent of battles survived, null when the source does not count them. */
  survival: number | null;
  /**
   * The three WN ratings for these battles, each null when it cannot be had.
   *
   * Only ever computed from Random Battles or from the vehicle's whole record,
   * and null for every other mode. The expected values the three are built
   * against are measured on Random Battles alone, so a Stronghold block run
   * through them would produce a number that looks like a rating and is not
   * (see `TANK_MODES_RATED`). PR and WTR are absent on purpose rather than null:
   * they are career account figures and have no per-vehicle value, which is why
   * a per-vehicle surface falls back to a WN rating.
   */
  ratings: { wn7: number | null; wn8: number | null; wnx: number | null };
  /** When the fetch these counters came from landed. */
  updatedAt: Date | null;
};

/** The counters every source here can answer, in one shape. */
type Counters = {
  battles: number;
  wins: number;
  damageDealt: number;
  frags: number;
  spotted: number;
  droppedCapturePoints: number;
  radioAssistedDamage: number;
  trackAssistedDamage: number;
  xp: number | null;
  survivedBattles: number | null;
  updatedAt: Date | null;
};

/**
 * The most pairs one call will look at.
 *
 * A battle is thirty vehicles and a caller asking about a roster is the reason
 * this exists, so the ceiling is the roster plus room. It bounds the two
 * VALUES joins below, not a page of results.
 */
export const MAX_VEHICLE_PAIRS = 60;

/** The two blocks `all` carries that Random Battles is `all` less. */
const NOT_RANDOM = [TankBattleMode.Clan, TankBattleMode.Company] as const;

function zero(): Counters {
  return {
    battles: 0,
    wins: 0,
    damageDealt: 0,
    frags: 0,
    spotted: 0,
    droppedCapturePoints: 0,
    radioAssistedDamage: 0,
    trackAssistedDamage: 0,
    xp: 0,
    survivedBattles: 0,
    updatedAt: null,
  };
}

/**
 * `left` less `right`, counter by counter.
 *
 * How Random Battles is had at all: `wot/tanks/stats` answers no `random` block
 * per vehicle, and `all` minus `clan` minus `company` IS it, exactly, verified
 * across 797 vehicle rows and 18 counters (see the `tank_modes` table). A
 * counter the left side cannot answer stays unanswered rather than becoming the
 * right side negated.
 */
function less(left: Counters, right: Counters): Counters {
  const sub = (a: number | null, b: number | null): number | null =>
    a == null ? null : Math.max(0, a - (b ?? 0));
  return {
    battles: Math.max(0, left.battles - right.battles),
    wins: Math.max(0, left.wins - right.wins),
    damageDealt: Math.max(0, left.damageDealt - right.damageDealt),
    frags: Math.max(0, left.frags - right.frags),
    spotted: Math.max(0, left.spotted - right.spotted),
    droppedCapturePoints: Math.max(
      0,
      left.droppedCapturePoints - right.droppedCapturePoints,
    ),
    radioAssistedDamage: Math.max(
      0,
      left.radioAssistedDamage - right.radioAssistedDamage,
    ),
    trackAssistedDamage: Math.max(
      0,
      left.trackAssistedDamage - right.trackAssistedDamage,
    ),
    xp: sub(left.xp, right.xp),
    survivedBattles: sub(left.survivedBattles, right.survivedBattles),
    updatedAt: left.updatedAt,
  };
}

/** The accumulators' own shape, for one vehicle's counters. */
function asTankStats(tankId: number, c: Counters): TankStats {
  return {
    tank_id: tankId,
    all: {
      battles: c.battles,
      wins: c.wins,
      damage_dealt: c.damageDealt,
      spotted: c.spotted,
      frags: c.frags,
      dropped_capture_points: c.droppedCapturePoints,
      radio_assisted_damage: c.radioAssistedDamage,
      track_assisted_damage: c.trackAssistedDamage,
      xp: c.xp ?? 0,
      ...(c.survivedBattles != null && { survived_battles: c.survivedBattles }),
    },
  } as TankStats;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

function mean(total: number | null, battles: number): number | null {
  return total != null && battles > 0 ? total / battles : null;
}

/**
 * What a player has done on a vehicle, in one mode or across all of them.
 *
 * Written for a battle: a caller holding a roster asks about thirty (account,
 * vehicle) pairs and the mode they are all playing, in one request, and gets
 * one record per pair. Two indexed reads whatever the size of the roster, on
 * the primary keys of both tables (`(player_id, tank_id, ...)`), because the
 * alternative in a battle is thirty round trips while the countdown runs.
 *
 * An account we hold nothing for, or a vehicle it has never taken out, is
 * absent from the answer rather than present with zeroes: "never played this"
 * and "played it badly" are different things, and only the second is a figure.
 */
export async function vehicleRecords(
  region: Region,
  pairs: VehiclePair[],
  mode: TankBattleMode | null,
): Promise<VehicleRecord[]> {
  if (pairs.length === 0) return [];
  const wanted = pairs.slice(0, MAX_VEHICLE_PAIRS);
  const ids = await getPlayerIdsByAccounts(
    region,
    Array.from(new Set(wanted.map((p) => p.accountId))),
  );
  // A pair whose account we hold no row for cannot be read and cannot be
  // answered, so it never reaches the SQL.
  const keyed = wanted
    .map((p) => ({ ...p, playerId: ids.get(p.accountId) }))
    .filter((p): p is VehiclePair & { playerId: number } => p.playerId != null);
  if (keyed.length === 0) return [];

  const values = sql.join(
    keyed.map((p) => sql`(${p.playerId}::int, ${p.tankId}::int)`),
    sql`, `,
  );
  const snapshots = tankSnapshotsByRegion[region];
  const modes = tankModesByRegion[region];

  const [overall, blocks, book, wn8Expected, wnxExpected] = await Promise.all([
    // The newest row per pair. Ordered exactly as `getLatestTankSnapshotsByAccounts`
    // orders it, so the two readers cannot disagree about which row is current.
    db.execute(sql`
      SELECT DISTINCT ON (s.player_id, s.tank_id)
             s.player_id, s.tank_id, s.taken_at, s.battles, s.wins,
             s.damage_dealt, s.frags, s.spotted, s.dropped_capture_points,
             s.radio_assisted_damage, s.track_assisted_damage, s.xp,
             s.survived_battles
      FROM ${snapshots} AS s
      JOIN (VALUES ${values}) AS want(player_id, tank_id)
        ON want.player_id = s.player_id AND want.tank_id = s.tank_id
      ORDER BY s.player_id, s.tank_id, s.taken_at DESC, s.battles DESC
    `) as unknown as Promise<
      Array<{
        player_id: number;
        tank_id: number;
        taken_at: Date;
        battles: number;
        wins: number;
        damage_dealt: number;
        frags: number;
        spotted: number;
        dropped_capture_points: number;
        radio_assisted_damage: number;
        track_assisted_damage: number;
        xp: number | null;
        survived_battles: number | null;
      }>
    >,
    // Every mode row for the pairs, not only the one asked for: Random is
    // derived from `clan` and `company` whatever the question was.
    db.execute(sql`
      SELECT m.player_id, m.tank_id, m.mode, m.updated_at, m.battles, m.wins,
             m.damage_dealt, m.frags, m.spotted, m.dropped_capture_points,
             m.radio_assisted_damage, m.track_assisted_damage, m.xp,
             m.survived_battles
      FROM ${modes} AS m
      JOIN (VALUES ${values}) AS want(player_id, tank_id)
        ON want.player_id = m.player_id AND want.tank_id = m.tank_id
    `) as unknown as Promise<
      Array<{
        player_id: number;
        tank_id: number;
        mode: string;
        updated_at: Date;
        battles: number;
        wins: number;
        damage_dealt: number;
        frags: number;
        spotted: number;
        dropped_capture_points: number;
        radio_assisted_damage: number;
        track_assisted_damage: number;
        xp: number | null;
        survived_battles: number | null;
      }>
    >,
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);

  const pairKey = (playerId: number, tankId: number) => `${playerId}:${tankId}`;

  const allByPair = new Map<string, Counters>();
  for (const row of overall) {
    allByPair.set(pairKey(row.player_id, row.tank_id), {
      battles: row.battles,
      wins: row.wins,
      damageDealt: Number(row.damage_dealt),
      frags: row.frags,
      spotted: row.spotted,
      droppedCapturePoints: row.dropped_capture_points,
      radioAssistedDamage: Number(row.radio_assisted_damage),
      trackAssistedDamage: Number(row.track_assisted_damage),
      xp: row.xp == null ? null : Number(row.xp),
      survivedBattles: row.survived_battles,
      updatedAt: row.taken_at,
    });
  }

  const modesByPair = new Map<string, Map<string, Counters>>();
  for (const row of blocks) {
    const key = pairKey(row.player_id, row.tank_id);
    let held = modesByPair.get(key);
    if (!held) modesByPair.set(key, (held = new Map()));
    held.set(row.mode, {
      battles: row.battles,
      wins: row.wins,
      damageDealt: Number(row.damage_dealt),
      frags: row.frags,
      spotted: row.spotted,
      droppedCapturePoints: row.dropped_capture_points,
      radioAssistedDamage: Number(row.radio_assisted_damage),
      trackAssistedDamage: Number(row.track_assisted_damage),
      xp: row.xp == null ? null : Number(row.xp),
      survivedBattles: row.survived_battles,
      updatedAt: row.updated_at,
    });
  }

  // No (tier, type) fallback, for the reason `rateOne` gives in battles/read:
  // on one vehicle it would rate it against another's expectations, and a
  // missing rating is the honest answer while every other figure still shows.
  const noFallback = new Map<string, WN8Expected>();

  const out: VehicleRecord[] = [];
  for (const pair of keyed) {
    const key = pairKey(pair.playerId, pair.tankId);
    const all = allByPair.get(key);
    const held = modesByPair.get(key);

    let scope: VehicleRecordScope = "overall";
    let covered: TankBattleMode | null = null;
    let counters: Counters | undefined;

    if (mode === TankBattleMode.Random && all) {
      // Derived, not stored, and only when `all` is there to derive it from.
      counters = NOT_RANDOM.reduce(
        (left, name) => less(left, held?.get(name) ?? zero()),
        all,
      );
      scope = "mode";
      covered = TankBattleMode.Random;
    } else if (mode && mode !== TankBattleMode.Random) {
      const block = held?.get(mode);
      // A mode with no row is a mode never played on this vehicle, which is
      // worth saying: the record is the mode's, and it is empty.
      counters = block ?? (all ? zero() : undefined);
      if (counters) {
        scope = "mode";
        covered = mode;
      }
    } else {
      counters = all;
    }
    if (!counters) continue;
    if (counters.battles === 0 && scope === "overall") continue;

    // The counters are comparable to the expected values only when they are
    // Random's or the whole record's, which is mostly Random anyway.
    const rateable = scope === "overall" || covered === TankBattleMode.Random;
    const ratings = { wn7: null, wn8: null, wnx: null } as VehicleRecord["ratings"];
    if (rateable && counters.battles > 0) {
      const one = asTankStats(pair.tankId, counters);
      const wn7 = wn7AccZero();
      const wn8 = wn8AccZero();
      const wnx = wnxAccZero();
      wn7AccAdd(wn7, one, book);
      wn8AccAdd(wn8, one, wn8Expected, book, noFallback);
      wnxAccAdd(wnx, one, wnxExpected);
      ratings.wn7 = wn7Finalize(wn7);
      ratings.wn8 = wn8Finalize(wn8);
      ratings.wnx = wnxFinalize(wnx);
    }

    out.push({
      accountId: pair.accountId,
      tankId: pair.tankId,
      scope,
      mode: covered,
      battles: counters.battles,
      winrate: ratio(counters.wins, counters.battles),
      avgDamage: mean(counters.damageDealt, counters.battles),
      avgXp: mean(counters.xp, counters.battles),
      survival:
        counters.survivedBattles == null
          ? null
          : ratio(counters.survivedBattles, counters.battles),
      ratings,
      updatedAt: counters.updatedAt,
    });
  }
  return out;
}
