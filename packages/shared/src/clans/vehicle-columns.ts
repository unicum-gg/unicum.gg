import {
  fromColumns,
  toColumns,
  type ColumnDecimals,
  type ColumnsOf,
} from "../lib/columns";
import type { ClanVehicleRow } from "./vehicles";

/**
 * A clan's vehicles as they cross the wire: one array per field.
 *
 * The same table as the player's garage seen from the other side, and it was in
 * the same state: measured on a 974-row clan, 338,521 octets of rows against
 * 122,593 transposed, which is **2.76x**. Rather more than the garage's, since
 * every figure here is an average over dozens of members and arrives at full
 * double precision for cells that print whole numbers.
 */
export type ClanVehicleColumns = ColumnsOf<ClanVehicleRow>;

/**
 * Exactly what the table prints, read off the cells like the garage's own: the
 * two averages fill cells rounded to the unit, the rating column prints two
 * decimals, and a win rate is shown as a percentage with two decimals, which is
 * four on the fraction. See `TANK_DECIMALS` for why it is the display's own
 * precision rather than a safer-looking one.
 *
 * The member count, the battle total and the vehicle identity cross exactly.
 */
const VEHICLE_DECIMALS: ColumnDecimals<ClanVehicleRow> = {
  avgDamage: 0,
  avgXp: 0,
  winrate: 4,
  wn7: 2,
  wn8: 2,
  wnx: 2,
};

/**
 * Every column the shape declares, for the two reasons the garage's own
 * template carries: the transposer reads its keys off the rows, so a clan with
 * no vehicles would otherwise answer with no columns at all, and `ColumnsOf`
 * requires the lot, so a field added to the row is a compile error here rather
 * than a field that silently stops crossing the wire.
 */
const EMPTY_COLUMNS: ClanVehicleColumns = {
  tankId: null,
  name: null,
  shortName: null,
  tier: null,
  nation: null,
  type: null,
  isPremium: null,
  role: null,
  isReward: null,
  memberCount: null,
  battles: null,
  avgDamage: null,
  avgXp: null,
  winrate: null,
  wn7: null,
  wn8: null,
  wnx: null,
};

export function clanVehicleColumns(
  rows: readonly ClanVehicleRow[],
): ClanVehicleColumns {
  return { ...EMPTY_COLUMNS, ...toColumns(rows, VEHICLE_DECIMALS) };
}

/**
 * The rows back. The length comes off `tankId`, the one column every vehicle
 * has, so a column dropped for holding only nulls cannot decide how many rows
 * there are.
 */
export function clanVehicleRows(
  columns: ClanVehicleColumns,
): ClanVehicleRow[] {
  return fromColumns(columns, columns.tankId?.length ?? 0);
}
