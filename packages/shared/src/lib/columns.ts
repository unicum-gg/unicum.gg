/**
 * Rows as one array per field, which is how a long table crosses the wire here.
 *
 * **A field name costs as much as the number beside it.** Measured on a
 * 972-vehicle garage, the player's tank list came to 535,227 octets of which
 * 251,748 were the twenty-seven field names, written once per row: 47% of the
 * payload spelling out what the shape already says. A clan's vehicle list is
 * the same table from the other side and was in the same state.
 *
 * So the rows are transposed. The names are written once, the values keep their
 * own order, and the receiving end turns them back into the rows every consumer
 * already reads. It is the transport only: nothing downstream of `fromColumns`
 * knows this happened, which is what makes it safe to apply to a table with
 * client-side sorting, filtering and pagination over it.
 *
 * The same shape is already published for the Onslaught season curve
 * (`onslaughtSeries`). This is that idea with no per-field mapping to get
 * wrong: the keys are read off the rows rather than listed, so a field added to
 * a row crosses the wire the day it is added.
 */
export type ColumnsOf<T> = { [K in keyof T]: T[K][] | null };

/**
 * How many decimals a numeric column is worth carrying.
 *
 * Nothing here is displayed at full precision: an average damage of
 * `3147.423279648609` fills a cell that reads `3147`, and a win rate of
 * `0.6408003904343582` one that reads `64.08%`. Seventeen significant digits of
 * a figure shown to two is 1.13x the payload on the garage alone, so a column
 * is rounded to a decimal the renderers cannot see past.
 *
 * It is a per-field decision rather than one number, because a win rate is a
 * fraction (two decimals on screen is six here) while a rating is a count.
 * Omit a field to carry it exactly, which is what every identifier, count and
 * price does.
 */
export type ColumnDecimals<T> = Partial<Record<keyof T, number>>;

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

/**
 * The rows as columns.
 *
 * A column holding nothing but nulls is sent as `null` rather than as a
 * thousand of them, since an absent column already reads as null on the way
 * back. On a stranger's garage that is `owned` and `moePercent`, both of which
 * only ever carry a value for an account that has signed in or runs the mod.
 */
export function toColumns<T extends object>(
  /** A row may be absent, which is how a nested object that only some rows
   * carry is transposed: every one of its columns reads null at that position,
   * and the caller decides what an absent row means on the way back. */
  rows: readonly (T | null)[],
  decimals?: ColumnDecimals<T>,
): ColumnsOf<T> {
  const keys = new Set<keyof T>();
  for (const row of rows) {
    if (row == null) continue;
    for (const key of Object.keys(row) as (keyof T)[]) keys.add(key);
  }
  const columns = {} as ColumnsOf<T>;
  for (const key of keys) {
    const places = decimals?.[key];
    let empty = true;
    const column = rows.map((row) => {
      const value = row?.[key];
      if (value === null || value === undefined) return null as T[typeof key];
      empty = false;
      return (places !== undefined && typeof value === "number"
        ? round(value, places)
        : value) as T[typeof key];
    });
    columns[key] = empty ? null : column;
  }
  return columns;
}

/**
 * The rows back, in the order they were sent.
 *
 * `length` is taken from a column the shape guarantees (an identifier, never a
 * nullable figure) rather than from the widest one present, for the reason the
 * Onslaught curve reads its own length off `t`: a column that was dropped for
 * holding only nulls would otherwise decide how many rows there are.
 *
 * A field no column carries reads as null, which is what it was.
 */
export function fromColumns<T extends object>(
  columns: ColumnsOf<T>,
  length: number,
): T[] {
  const entries = Object.entries(columns) as [keyof T, T[keyof T][] | null][];
  return Array.from({ length }, (_, i) => {
    const row = {} as T;
    for (const [key, column] of entries) {
      row[key] = (column?.[i] ?? null) as T[typeof key];
    }
    return row;
  });
}
