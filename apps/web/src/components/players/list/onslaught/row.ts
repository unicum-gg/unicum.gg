// One Onslaught board row and everything the board reads off it: what it can be
// sorted by, and how recently the player was seen playing.

/** Shape of the `/players/onslaught` response rows (OnslaughtSummary). */
export type OnslaughtRow = {
  rank: number;
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  recordedNickname: string;
  recordedClanTag: string | null;
  recordedClanColor: string | null;
  rating: number;
  battles: number;
  // Folded from our own captures, so absent for a season that ended before we
  // were recording it, and for a player who has not moved since they qualified.
  // The whole group is absent together, never half of it.
  activeDays?: number;
  battlesPerDay?: number;
  pointsPerDay?: number;
  pointsPerBattle?: number;
  /** Unix seconds of the last capture where their battle count moved. */
  lastActiveAt?: number;
  /** Battles played in the mode when they first appeared on the board: what
   * qualifying cost them. Absent for the few already ranked when we started
   * recording the season, whose first row is a state rather than an entry. */
  entryBattles?: number;
  // The account's own rating in ordinary battles, all three metrics, since the
  // reader picks which one they read in the navbar.
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
};

/**
 * The columns the board re-sorts by, client-side over the fully loaded set.
 *
 * The values are what `?sort=` carries, so they are the API's own field names
 * and renaming one breaks a shared link.
 */
export enum OnslaughtSortCol {
  Battles = "battles",
  Rating = "rating",
  BattlesPerDay = "battlesPerDay",
  PointsPerDay = "pointsPerDay",
  PointsPerBattle = "pointsPerBattle",
}

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export type OnslaughtSortState = {
  col: OnslaughtSortCol;
  dir: SortDirection;
};

export function isOnslaughtSortCol(value: string): value is OnslaughtSortCol {
  return (Object.values(OnslaughtSortCol) as string[]).includes(value);
}

/**
 * The sorted value of one column, or null when the row has no such figure.
 *
 * Null rather than zero, and `compareBy` puts nulls last whichever way the
 * column is sorted. Points per day is signed: read as zero, a player we have
 * watched play nothing would outrank one who is genuinely losing rating, so the
 * bottom of the board would read "we do not know" while claiming to be the
 * worst performers.
 */
export function sortValue(
  row: OnslaughtRow,
  col: OnslaughtSortCol,
): number | null {
  switch (col) {
    case OnslaughtSortCol.Battles:
      return row.battles;
    case OnslaughtSortCol.Rating:
      return row.rating;
    case OnslaughtSortCol.BattlesPerDay:
      return row.battlesPerDay ?? null;
    case OnslaughtSortCol.PointsPerDay:
      return row.pointsPerDay ?? null;
    case OnslaughtSortCol.PointsPerBattle:
      return row.pointsPerBattle ?? null;
  }
}

/** Comparator for one column, absent figures always last. */
export function compareBy(
  col: OnslaughtSortCol,
  dir: SortDirection,
): (a: OnslaughtRow, b: OnslaughtRow) => number {
  const sign = dir === SortDirection.Asc ? 1 : -1;
  return (a, b) => {
    const left = sortValue(a, col);
    const right = sortValue(b, col);
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    return (left - right) * sign;
  };
}

/**
 * Which of the board's two lists is on screen.
 *
 * Two views of one panel rather than two tables down the page: the standings
 * answer who is ranked and the other answers who was, and reading either means
 * scanning a table, which is not something a reader should have to do twice on
 * one screen. `?view=lost` carries it, like the maps section's own view keys.
 */
export enum BoardView {
  Ranked = "ranked",
  Lost = "lost",
}

export function isBoardView(value: string): value is BoardView {
  return (Object.values(BoardView) as string[]).includes(value);
}

/**
 * The columns the lost-place view re-sorts by.
 *
 * Its own vocabulary rather than the standings' one, because it answers about a
 * place that no longer exists: there is no current rank to sort on, and the two
 * that matter (the best they reached, and when they fell out) mean nothing on
 * the board beside it. `?lostSort=` carries it, apart from the standings' own
 * `?sort=`, so switching tabs cannot silently reinterpret a column name.
 */
export enum DropoutSortCol {
  BestRank = "bestRank",
  LastRank = "lastRank",
  Rating = "lastRating",
  Battles = "battles",
  LeftAt = "lastSeenAt",
}

export function isDropoutSortCol(value: string): value is DropoutSortCol {
  return (Object.values(DropoutSortCol) as string[]).includes(value);
}

export type DropoutSortState = { col: DropoutSortCol; dir: SortDirection };

/** How recently a ranked player was last seen playing. */
export enum ActivityBucket {
  Today = "today",
  Week = "week",
  Idle = "idle",
}

export const ACTIVITY_BUCKETS = [
  ActivityBucket.Today,
  ActivityBucket.Week,
  ActivityBucket.Idle,
] as const;

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Which bucket a row falls in, against a reference instant.
 *
 * Exactly one bucket per row, so selecting several chips is a union and the
 * counts add up to the board.
 *
 * The reference is the board's own newest capture rather than the reader's
 * clock, for two reasons. The page is prerendered and hydrated, so a clock read
 * during render disagrees with itself across that boundary. And if the capture
 * ever stalls, a wall clock would quietly move the whole field to Idle, which
 * reads as everyone having stopped playing rather than as us having stopped
 * looking.
 */
export function activityBucket(
  row: OnslaughtRow,
  reference: number,
): ActivityBucket {
  if (row.lastActiveAt == null) return ActivityBucket.Idle;
  const age = reference - row.lastActiveAt;
  if (age <= DAY_SECONDS) return ActivityBucket.Today;
  if (age <= 7 * DAY_SECONDS) return ActivityBucket.Week;
  return ActivityBucket.Idle;
}

/** The newest capture on the board, which is the clock everything above reads. */
export function activityReference(rows: OnslaughtRow[]): number {
  let newest = 0;
  for (const row of rows) {
    if (row.lastActiveAt != null && row.lastActiveAt > newest) {
      newest = row.lastActiveAt;
    }
  }
  return newest;
}

/**
 * What a rank costs, read straight off the standings.
 *
 * The board IS the answer to that question and always has been: the player
 * holding the last Legend position shows what Legend costs, and the bottom of
 * the board is Champion's threshold, since the board reaches exactly that far.
 * Reading it here rather than from a capture is what lets a season we never
 * sampled still say what it took, which is every season that ended before the
 * feeder existed.
 *
 * The floor is reduced rather than spread into `Math.min`: the board is fetched
 * whole and a spread of sixty thousand arguments is how that call starts
 * throwing.
 */
export function boardStandings(
  results: OnslaughtRow[],
  elitePosition: number | null,
): { ranked: number; legendPoints: number | null; championPoints: number | null } {
  return {
    ranked: results.length,
    legendPoints:
      elitePosition == null
        ? null
        : (results.find((r) => r.rank === elitePosition)?.rating ?? null),
    championPoints: results.reduce<number | null>(
      (low, r) => (low == null || r.rating < low ? r.rating : low),
      null,
    ),
  };
}
