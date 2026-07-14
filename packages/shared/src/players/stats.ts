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
