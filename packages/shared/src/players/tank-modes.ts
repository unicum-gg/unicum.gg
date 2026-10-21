import type { TankModeRow } from "../db/schema/tank-modes";
import {
  TANK_BATTLE_MODES,
  TANK_MODES_IN_OVERALL,
  TANK_MODES_MULTI_VEHICLE,
  TANK_MODES_RETIRED,
  TankBattleMode,
  tankBattleMode,
} from "../wot/tank-modes";
import type { TankModeBlock, TankRecordBlock } from "./tank-detail";

const RETIRED = new Set<TankBattleMode>(TANK_MODES_RETIRED);
const MULTI_VEHICLE = new Set<TankBattleMode>(TANK_MODES_MULTI_VEHICLE);

/** The record scores Wargaming puts outside the per-mode blocks, at the top
 * level beside `tank_id`. */
export type OverallRecordScores = {
  maxXp: number | null;
  maxFrags: number | null;
};

/**
 * A stored row, back in the shape the record derivation reads.
 *
 * `damage_blocked` goes the other way round from how it was written: Wargaming
 * reports a per-battle average, the column holds the total so it sums and
 * diffs, and the builder wants the average again.
 */
export function tankModeBlockFromRow(row: TankModeRow): TankRecordBlock {
  return {
    battles: row.battles,
    wins: row.wins,
    damage_dealt: row.damageDealt,
    damage_received: row.damageReceived,
    spotted: row.spotted,
    frags: row.frags,
    capture_points: row.capturePoints,
    dropped_capture_points: row.droppedCapturePoints,
    xp: row.xp,
    survived_battles: row.survivedBattles,
    hits: row.hits,
    shots: row.shots,
    radio_assisted_damage: row.radioAssistedDamage,
    track_assisted_damage: row.trackAssistedDamage,
    stun_number: row.stunNumber,
    stun_assisted_damage: row.stunAssistedDamage,
    piercings: row.piercings ?? undefined,
    avg_damage_blocked:
      row.damageBlocked == null || row.battles <= 0
        ? undefined
        : row.damageBlocked / row.battles,
    tanking_factor: row.tankingFactor ?? undefined,
    max_damage: row.maxDamage ?? undefined,
    max_xp: row.maxXp ?? undefined,
    max_frags: row.maxFrags ?? undefined,
  };
}

/**
 * Random Battles, worked out from the overall block and the two other parts of
 * it.
 *
 * `all` is `random` + `clan` + `company`, exactly: checked across 797 vehicle
 * rows and 18 counters with zero mismatches, and again against the account-level
 * totals, where the per-vehicle sums reconcile to the battle. So Random needs no
 * row of its own, and deriving it is better than storing it even setting its 290
 * million rows aside, because the three parts can then never add up to something
 * other than the figure the rest of the site shows for that vehicle.
 *
 * Three of `all`'s fields cannot be subtracted, because `clan` and `company` do
 * not report them at all: the pierced-shot count, the blocked damage and
 * Wargaming's armour factor. They are carried over only when those two modes
 * contributed no battles, which is the overwhelming majority of vehicles, and
 * left absent otherwise rather than quietly crediting all three modes' armour
 * work to Random. The record scores go the same way, for that reason and because
 * a maximum does not subtract either.
 *
 * Returns null when nothing is left, which is a vehicle only ever taken into
 * Clan or Company battles.
 */
export function deriveRandomBlock(
  all: TankRecordBlock,
  overall: OverallRecordScores,
  byMode: Map<TankBattleMode, TankModeRow>,
): TankRecordBlock | null {
  const parts = TANK_MODES_IN_OVERALL.map((mode) => byMode.get(mode)).filter(
    (row): row is TankModeRow => row != null,
  );
  /** What the other parts of `all` took, for one counter. */
  const taken = (pick: (row: TankModeRow) => number): number =>
    parts.reduce((total, row) => total + pick(row), 0);
  // A counter cannot go negative, so `Math.max` here is a guard against the
  // identity above ceasing to hold upstream rather than an expected case: it
  // keeps a page readable instead of rendering an impossible figure.
  const less = (base: number, pick: (row: TankModeRow) => number): number =>
    Math.max(0, base - taken(pick));

  const battles = less(all.battles, (row) => row.battles);
  if (battles <= 0) return null;
  const sharedByBoth = taken((row) => row.battles) > 0;

  return {
    battles,
    wins: less(all.wins, (row) => row.wins),
    damage_dealt: less(all.damage_dealt, (row) => row.damageDealt),
    spotted: less(all.spotted, (row) => row.spotted),
    frags: less(all.frags, (row) => row.frags),
    dropped_capture_points: less(
      all.dropped_capture_points,
      (row) => row.droppedCapturePoints,
    ),
    radio_assisted_damage: less(
      all.radio_assisted_damage,
      (row) => row.radioAssistedDamage,
    ),
    track_assisted_damage: less(
      all.track_assisted_damage,
      (row) => row.trackAssistedDamage,
    ),
    xp: less(all.xp, (row) => row.xp),
    damage_received:
      all.damage_received == null
        ? undefined
        : less(all.damage_received, (row) => row.damageReceived),
    capture_points:
      all.capture_points == null
        ? undefined
        : less(all.capture_points, (row) => row.capturePoints),
    survived_battles:
      all.survived_battles == null
        ? undefined
        : less(all.survived_battles, (row) => row.survivedBattles),
    hits: all.hits == null ? undefined : less(all.hits, (row) => row.hits),
    shots: all.shots == null ? undefined : less(all.shots, (row) => row.shots),
    stun_number:
      all.stun_number == null
        ? undefined
        : less(all.stun_number, (row) => row.stunNumber),
    stun_assisted_damage:
      all.stun_assisted_damage == null
        ? undefined
        : less(all.stun_assisted_damage, (row) => row.stunAssistedDamage),

    // The three `clan` and `company` never report. Dropped when those two
    // contributed battles, since what `all` holds then covers their work too
    // and crediting it to Random would overstate it.
    piercings: sharedByBoth ? undefined : all.piercings,
    avg_damage_blocked: sharedByBoth ? undefined : all.avg_damage_blocked,
    tanking_factor: sharedByBoth ? undefined : all.tanking_factor,
    // The record scores are carried over ALWAYS, unlike the three above, and
    // the difference is that a maximum is a property of the vehicle rather than
    // of a mode: Wargaming puts these at the top level, outside every block,
    // for that reason. Dropping them when a decade-old Clan Battle shares the
    // record would blank the whole Record Score block on exactly the veterans
    // this breakdown is for, and there is no overall view left to find it in.
    max_xp: overall.maxXp ?? undefined,
    max_frags: overall.maxFrags ?? undefined,
    // Absent either way: Wargaming reports no best-damage figure for Random (0
    // on every row measured) and none at the top level.
    max_damage: undefined,
  };
}

/**
 * Every mode this vehicle was played in, Random included, in the order the
 * breakdown reads.
 *
 * A mode with no battles never makes it this far: the readers hand over only
 * the rows that exist, and `buildPlayerTankModeRecords` drops a block that
 * somehow holds none.
 */
export function tankModeBlocks(
  all: TankRecordBlock,
  overall: OverallRecordScores,
  rows: TankModeRow[],
): TankModeBlock[] {
  const byMode = new Map<TankBattleMode, TankModeRow>();
  for (const row of rows) {
    const mode = tankBattleMode(row.mode);
    if (mode) byMode.set(mode, row);
  }

  const out: TankModeBlock[] = [];
  for (const mode of TANK_BATTLE_MODES) {
    const row = byMode.get(mode);
    const stats =
      mode === TankBattleMode.Random
        ? deriveRandomBlock(all, overall, byMode)
        : row
          ? tankModeBlockFromRow(row)
          : null;
    if (!stats) continue;
    out.push({
      mode,
      stats,
      retired: RETIRED.has(mode),
      multiVehicle: MULTI_VEHICLE.has(mode),
    });
  }
  return out;
}

/**
 * Every mode's block for one vehicle, keyed by mode.
 *
 * The same derivation as `tankModeBlocks`, as a lookup rather than a list, for
 * the garage table: it needs one named mode across every vehicle where the
 * vehicle record needs every mode on one vehicle.
 */
export function tankModeBlockMap(
  all: TankRecordBlock,
  overall: OverallRecordScores,
  rows: TankModeRow[],
): Map<TankBattleMode, TankRecordBlock> {
  return new Map(
    tankModeBlocks(all, overall, rows).map((block) => [block.mode, block.stats]),
  );
}

/**
 * A mode a player has a record in, and how much of one.
 *
 * Vehicles rather than battles, and that is not laziness: Fallout counts one
 * battle against every vehicle fielded in it, so a battle total over vehicles
 * would be inflated for that mode alone and silently wrong (1.6x to 2.6x,
 * measured). A vehicle count is honest for every mode, and it is also the
 * figure a table of vehicles should be labelled with. The battle totals that
 * ARE correct live on the profile's own mode tabs, which read them from the
 * account-level blocks.
 */
export type TankModeAvailability = {
  mode: TankBattleMode;
  /** Vehicles this player has a record on in this mode. */
  tanks: number;
  retired: boolean;
  multiVehicle: boolean;
};

/**
 * Which modes this player's garage has anything in, in mode order.
 *
 * Random is counted by derivation like everywhere else, so a player who has
 * only ever played Clan Battles on a vehicle does not get a phantom Random row
 * for it.
 */
export function availableTankModes(
  /** Each vehicle's blocks, as `tankModeBlockMap` built them. Taken already
   * derived rather than derived here, so the caller's mode filter and this
   * count read one pass instead of two. */
  blocksByTank: Map<number, Map<TankBattleMode, TankRecordBlock>>,
): TankModeAvailability[] {
  const counts = new Map<TankBattleMode, number>();
  for (const blocks of blocksByTank.values()) {
    for (const mode of blocks.keys()) {
      counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
  }
  return TANK_BATTLE_MODES.filter((mode) => (counts.get(mode) ?? 0) > 0).map(
    (mode) => ({
      mode,
      tanks: counts.get(mode) ?? 0,
      retired: RETIRED.has(mode),
      multiVehicle: MULTI_VEHICLE.has(mode),
    }),
  );
}
