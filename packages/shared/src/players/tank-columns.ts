import {
  fromColumns,
  toColumns,
  type ColumnDecimals,
  type ColumnsOf,
} from "../lib/columns";
import type { TankMarkReach } from "./mark-progress";
import type { PlayerTankCareer, PlayerTankRow, PlayerTanksPayload } from "./tanks";

/** The vehicle row less its nested fields, which are transposed on their own. */
type FlatPlayerTankRow = Omit<PlayerTankRow, "markReach" | "career">;

/**
 * A player's garage as it crosses the wire: one array per field.
 *
 * Measured on a 972-vehicle garage, the row-per-vehicle form came to 535,227
 * octets and this one to 198,708, which is **2.69x** for a table nothing on
 * screen reads differently. Half of what went was the field names, written
 * twenty-seven times a vehicle; the rest was precision no cell shows (see
 * `ColumnDecimals`).
 *
 * It matters twice over, because this list is both fetched by a reader who
 * opens the Tanks tab AND prerendered into the page of every `/tanks` address,
 * where it then sits in the ISR store beside two million other player pages.
 */
export type PlayerTankColumns = ColumnsOf<FlatPlayerTankRow> & {
  /** The marks comparison, transposed like the rows around it. Null when no
   * vehicle in the garage has one, which is the usual case below tier V. */
  markReach: ColumnsOf<TankMarkReach> | null;
  /** The career figures of a windowed list, transposed the same way. Null on
   * a list that is not windowed. */
  career: ColumnsOf<PlayerTankCareer> | null;
};

/** The garage list as the endpoint answers it. */
export type PlayerTanksColumnsPayload = Omit<PlayerTanksPayload, "tanks"> & {
  tanks: PlayerTankColumns;
};

/**
 * What each figure is worth carrying, which is **exactly what the table
 * prints** and not a decimal more.
 *
 * Read off the cells rather than guessed: average damage and experience fill a
 * cell rounded to the unit, a win rate is shown as a percentage with two
 * decimals (so four on the fraction), and the rating column prints two. That
 * identity is the whole safety of the thing: rounding to a precision FINER than
 * the display would still be invisible almost always, and "almost" over two
 * million player pages is a figure that disagrees with the record panel beside
 * it. At the display's own precision the rendered string cannot move, because
 * both this and `Intl.NumberFormat` round a positive value half away from zero
 * at the same place.
 *
 * `moePercent` is already two decimals where it exists (the mod reports it that
 * way), so its entry is a statement of the shape rather than a rounding.
 *
 * Everything absent from this list crosses exactly: identifiers, battle counts,
 * marks, the three prices the account valuation adds up, and every figure of
 * the marks comparison, which the source already holds as whole numbers.
 */
const TANK_DECIMALS: ColumnDecimals<FlatPlayerTankRow> = {
  avgDamage: 0,
  avgXp: 0,
  winrate: 4,
  wn7: 2,
  wn8: 2,
  wnx: 2,
  moePercent: 2,
};

/**
 * Every column the shape declares, so each one is published whether or not the
 * garage has anything to put in it.
 *
 * Two jobs, and the second is the reason it is written out rather than derived.
 * The transposer reads its keys off the rows, so an empty garage would answer
 * with no columns at all and a response schema could only describe them as
 * optional. And `ColumnsOf` requires the lot, so a field added to the vehicle
 * row is a compile error here until it is listed, where otherwise it would
 * simply stop crossing the wire and nothing would say so.
 */
const EMPTY_COLUMNS: ColumnsOf<FlatPlayerTankRow> = {
  tankId: null,
  slug: null,
  name: null,
  shortName: null,
  tag: null,
  tier: null,
  nation: null,
  type: null,
  role: null,
  isPremium: null,
  isReward: null,
  owned: null,
  mom: null,
  moe: null,
  moePercent: null,
  battles: null,
  avgDamage: null,
  avgXp: null,
  winrate: null,
  wn7: null,
  wn8: null,
  wnx: null,
  buyGold: null,
  buyCredits: null,
  researchXp: null,
};

/** The career figures are rounded like the row figures they sit beside. */
const CAREER_DECIMALS: ColumnDecimals<PlayerTankCareer> = {
  avgDamage: 0,
  avgXp: 0,
  winrate: 4,
  wn7: 2,
  wn8: 2,
  wnx: 2,
};

const EMPTY_CAREER: ColumnsOf<PlayerTankCareer> = {
  battles: null,
  avgDamage: null,
  avgXp: null,
  winrate: null,
  wn7: null,
  wn8: null,
  wnx: null,
};

/** Same for the nested comparison, which is published whole or not at all. */
const EMPTY_REACH: ColumnsOf<TankMarkReach> = {
  mark1: null,
  mark2: null,
  mark3: null,
  combined: null,
  battles: null,
  window: null,
};

export function playerTankColumns(
  rows: readonly PlayerTankRow[],
): PlayerTankColumns {
  const flat = rows.map(({ markReach: _reach, career: _career, ...rest }) => rest);
  const reaches = rows.map((row) => row.markReach);
  const careers = rows.map((row) => row.career ?? null);
  return {
    ...EMPTY_COLUMNS,
    ...toColumns(flat, TANK_DECIMALS),
    markReach: reaches.some((reach) => reach != null)
      ? { ...EMPTY_REACH, ...toColumns(reaches) }
      : null,
    career: careers.some((c) => c != null)
      ? { ...EMPTY_CAREER, ...toColumns(careers, CAREER_DECIMALS) }
      : null,
  };
}

/**
 * The rows back, which is what every consumer reads.
 *
 * The length comes off `tankId`, the one column a vehicle always has: a
 * nullable figure would be dropped on a garage where nobody carries it and
 * would then report an empty list.
 *
 * A vehicle's marks comparison is read as present where its `window` is, for
 * the same reason: the five figures beside it are numbers that a vehicle
 * without a comparison genuinely has none of, so only the window says whether
 * the comparison was made at all.
 */
export function playerTankRows(columns: PlayerTankColumns): PlayerTankRow[] {
  const { markReach, career, ...flat } = columns;
  const length = columns.tankId?.length ?? 0;
  const rows = fromColumns(flat as ColumnsOf<FlatPlayerTankRow>, length);
  const reaches = markReach ? fromColumns(markReach, length) : [];
  // Read as present where `battles` is, the one career figure every vehicle
  // with a record has.
  const careers = career ? fromColumns(career, length) : [];
  return rows.map((row, i) => {
    const reach = reaches[i];
    const c = careers[i];
    return {
      ...row,
      markReach: reach?.window != null ? reach : null,
      career: c?.battles != null ? (c as PlayerTankCareer) : null,
    };
  });
}

/** The whole payload, rows transposed and the rest carried through. */
export function playerTanksColumns(
  payload: PlayerTanksPayload,
): PlayerTanksColumnsPayload {
  return { ...payload, tanks: playerTankColumns(payload.tanks) };
}
