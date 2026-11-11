import {
  ManeuversBoardKind,
  ManeuversOrder,
  ManeuversSort,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  type ManeuversBoard,
  readManeuversBoard,
} from "@/services/maneuvers/leaderboard";

/** Rows served by default, and the ceiling a caller can ask for. */
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 1000;

export type ManeuversBoardQuery = {
  eventName: string | null;
  /** The board paged through; both when absent, each sliced the same way. */
  board: ManeuversBoardKind | null;
  limit: number;
  offset: number;
  sort: ManeuversSort;
  order: ManeuversOrder;
  /** Case-insensitive search on a player's nickname, or a clan's tag and name. */
  q: string | null;
  /** A min/max window on one column; a row with no figure on it falls out. */
  range: ManeuversSort | null;
  min: number | null;
  max: number | null;
};

export type ManeuversBoardPage = ManeuversBoard & {
  /** Rows matching the query on each board, before paging. */
  totals: { players: number; clans: number };
};

type Row = {
  place: number;
  famePoints: number;
  gain24h: number | null;
  placeChange24h: number | null;
};

/**
 * One page of an edition's boards, searched and ordered across the whole of
 * them. Each row keeps its real place, so a search or a sort on the 24h gain
 * still says where a player stands on the board itself.
 */
export async function getManeuversBoardPage(
  region: Region,
  query: ManeuversBoardQuery,
): Promise<ManeuversBoardPage> {
  const whole = await readManeuversBoard(region, query.eventName);
  const needle = query.q?.trim().toLowerCase() || null;
  const inRange = rangeFilter(query);
  const limit = Math.min(Math.max(Math.trunc(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Math.trunc(query.offset) || 0, 0);

  const players =
    query.board === ManeuversBoardKind.Clans
      ? []
      : order(
          whole.players.filter(
            (r) =>
              (!needle || r.nickname?.toLowerCase().includes(needle)) && inRange(r),
          ),
          query,
        );
  const clans =
    query.board === ManeuversBoardKind.Players
      ? []
      : order(
          whole.clans.filter(
            (r) =>
              (!needle ||
                r.tag?.toLowerCase().includes(needle) ||
                r.name?.toLowerCase().includes(needle)) &&
              inRange(r),
          ),
          query,
        );

  return {
    ...whole,
    players: players.slice(offset, offset + limit),
    clans: clans.slice(offset, offset + limit),
    totals: { players: players.length, clans: clans.length },
  };
}

/** A row's figure on one of the sortable columns. */
function columnValue(row: Row, column: ManeuversSort): number | null {
  return column === ManeuversSort.Gain
    ? row.gain24h
    : column === ManeuversSort.Move
      ? row.placeChange24h
      : row.famePoints;
}

/** The min/max window as a predicate, letting everything through when unset. */
function rangeFilter(query: ManeuversBoardQuery): (row: Row) => boolean {
  const { range, min, max } = query;
  if (!range || (min == null && max == null)) return () => true;
  return (row) => {
    const v = columnValue(row, range);
    return v != null && (min == null || v >= min) && (max == null || v <= max);
  };
}

/**
 * Rows in the order asked for. Fame Points descending is the board's own
 * order, the rows' as stored. A row with no figure on the sorted column sinks
 * to the bottom either way, since a missing value is not a smallest one, and
 * ties keep the board's order.
 */
function order<T extends Row>(rows: T[], query: ManeuversBoardQuery): T[] {
  if (query.sort === ManeuversSort.FamePoints && query.order === ManeuversOrder.Desc) {
    return rows;
  }
  const value = (row: T) => columnValue(row, query.sort);
  const sign = query.order === ManeuversOrder.Desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va == null || vb == null) {
      return va == null && vb == null ? a.place - b.place : va == null ? 1 : -1;
    }
    return va === vb ? a.place - b.place : sign * (va - vb);
  });
}
