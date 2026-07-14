/** Totals for one non-random game mode (stronghold/ranked/CW/...) as sliced
 * from a player snapshot (client-safe shape). The snapshot projection helpers
 * (`skirmishStatsFromSnapshot`, ...) live in core (`players`). */
export type StrongholdStats = {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survivedBattles: number;
  frags: number;
  damageDealt: number;
  spotted: number;
  capturePoints: number;
  droppedCapturePoints: number;
  battleAvgXp: number;
};
