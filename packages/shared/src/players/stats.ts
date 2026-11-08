/** Player overall/random-battles totals (client-safe data shape).
 * The computation + snapshotting live in core (`players`).
 */
export type Stats = {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survivedBattles: number;
  frags: number;
  damageDealt: number;
  xp: number;
  spotted: number;
  capturePoints: number;
  droppedCapturePoints: number;
  hits: number;
  shots: number;
  globalRating: number;
  wtr: number | null;
};

/**
 * One of the profile's 24h/7d/30d columns: the same counters as `Stats`, over
 * a window.
 *
 * Diffed from the vehicles rather than from the account, because Wargaming
 * refreshes `account/info` only when the player logs out while `tanks/stats`
 * follows every battle: a column that took its battles from one and its
 * ratings from the other read 0 battles under a WN8 for a whole session.
 *
 * A counter is null when the window cannot answer it: a vehicle played in it
 * whose baseline row predates the column (`draws`, and so `losses`, before
 * migration 0142; the record fields on rows older still). Summing the vehicles
 * that do know would understate it without saying so. The two account ratings
 * are null when the account has no baseline that old.
 */
export type PlayerPeriodStats = Omit<
  Stats,
  | "losses"
  | "draws"
  | "survivedBattles"
  | "capturePoints"
  | "hits"
  | "shots"
  | "globalRating"
> & {
  losses: number | null;
  draws: number | null;
  survivedBattles: number | null;
  capturePoints: number | null;
  hits: number | null;
  shots: number | null;
  globalRating: number | null;
};
