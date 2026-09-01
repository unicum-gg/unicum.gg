import {
  compareValues,
  SortDirection,
  type SortState,
} from "@/components/tournaments/sort-head";
import type { PlaceSpan } from "./placements";
import type { TournamentTeam } from "./record";

export enum TeamSortColumn {
  Place = "place",
  Name = "name",
  Players = "players",
  Winrate = "wr",
  Rating = "rating",
  Recent = "recent",
}

export type TeamSortState = SortState<TeamSortColumn>;

export function isTeamSortColumn(value: string): value is TeamSortColumn {
  return (Object.values(TeamSortColumn) as string[]).includes(value);
}

/**
 * One row, with everything the table shows already resolved.
 *
 * Built once per render pass rather than recomputed in the cell: the sort needs
 * the same rating and win rate the row prints, and deriving them twice is how
 * the two drift.
 */
export type TeamRow = {
  team: TournamentTeam;
  /** Where they finished, null for a team the tournament never placed. */
  place: number | null;
  /** The full range that place covers, which is what a reward band is matched
   * against. Null alongside `place`. */
  span: PlaceSpan | null;
  /** Went through to the next stage. Only ever set on a tournament that decided
   * no overall order, where it is the closest thing to a result. */
  advanced: boolean;
  size: number;
  rating: number | null;
  /** The same rating over the trailing 30 days, carried only while the
   * tournament is still ahead: it is the form the field is scouted on. */
  recent: number | null;
  winrate: number | null;
};

/**
 * What a column sorts on, as a number or a string.
 *
 * Places are NEGATED, the same trick the clan members table uses on seniority:
 * the first click on any column is descending, which everywhere else means
 * "best first", and the best place is the smallest number. Without it, clicking
 * `#` would open on the teams knocked out first. A team with no placement sorts
 * below every placed one rather than as place zero.
 */
function sortValue(row: TeamRow, column: TeamSortColumn): number | string {
  switch (column) {
    case TeamSortColumn.Place:
      return row.place === null ? Number.NEGATIVE_INFINITY : -row.place;
    case TeamSortColumn.Name:
      return row.team.title.toLowerCase();
    case TeamSortColumn.Players:
      return row.size;
    case TeamSortColumn.Winrate:
      return row.winrate ?? -1;
    case TeamSortColumn.Rating:
      return row.rating ?? -1;
    case TeamSortColumn.Recent:
      return row.recent ?? -1;
  }
}

/**
 * The table's own order when nothing is sorted: how they finished, then by name
 * for everything the tournament never placed. That is the order the bracket
 * settled, so it is what the page opens on.
 */
export function compareTeams(
  a: TeamRow,
  b: TeamRow,
  state: TeamSortState,
): number {
  if (!state) {
    // Whoever went through comes first: on a qualifier there is no placement to
    // sort by, and the teams that advanced are the whole point of the page.
    if (a.advanced !== b.advanced) return a.advanced ? -1 : 1;
    const pa = a.place ?? Number.POSITIVE_INFINITY;
    const pb = b.place ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.team.title.localeCompare(b.team.title);
  }
  const cmp = compareValues(sortValue(a, state.column), sortValue(b, state.column));
  // Ties keep the finishing order, so a column with many equal values (every
  // team fielding eight players) still reads as the bracket left it.
  if (cmp === 0) return compareTeams(a, b, null);
  return state.direction === SortDirection.Asc ? cmp : -cmp;
}
