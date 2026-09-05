import {
  compareValues,
  SortDirection,
  type SortState,
} from "@/components/tournaments/sort-head";
import type { TournamentListRow } from "./board";

export enum TournamentSortColumn {
  Date = "date",
  Title = "title",
  Tier = "tier",
  Format = "format",
  Teams = "teams",
}

export type TournamentSortState = SortState<TournamentSortColumn>;

export function isTournamentSortColumn(
  value: string,
): value is TournamentSortColumn {
  return (Object.values(TournamentSortColumn) as string[]).includes(value);
}

/**
 * What a column sorts on.
 *
 * A tier band sorts on its floor, since that is what decides whether a
 * tournament is within reach: a VIII-X and a VIII-VIII both start at VIII.
 * Format sorts on the team size the tournament is played at (1v1 before 7v7).
 */
function sortValue(
  row: TournamentListRow,
  column: TournamentSortColumn,
): number | string {
  switch (column) {
    case TournamentSortColumn.Date:
      return row.startAt.getTime();
    case TournamentSortColumn.Title:
      return row.title.toLowerCase();
    case TournamentSortColumn.Tier:
      return row.tierFrom ?? row.tierTo ?? -1;
    case TournamentSortColumn.Format:
      return row.minPlayersInTeam;
    case TournamentSortColumn.Teams:
      return row.confirmedTeams;
  }
}

/**
 * The catalogue's own order when nothing is sorted: newest first, which is how
 * the endpoint returns it and the only order that answers "what is on now".
 */
export function compareTournaments(
  a: TournamentListRow,
  b: TournamentListRow,
  state: TournamentSortState,
): number {
  if (!state) return b.startAt.getTime() - a.startAt.getTime();
  const cmp = compareValues(sortValue(a, state.column), sortValue(b, state.column));
  // Ties fall back to newest first, so sorting by a coarse column (tier,
  // format) still reads chronologically within each band.
  if (cmp === 0) return b.startAt.getTime() - a.startAt.getTime();
  return state.direction === SortDirection.Asc ? cmp : -cmp;
}
