/**
 * The stored `last_battle_at` has two shapes of "no battle to show", and both
 * read as a 1970 timestamp if they reach a date formatter as-is:
 *
 * - the **epoch**, for an account that has never entered a battle (WG reports
 *   `last_battle_time: 0`, which the write paths keep verbatim: as the oldest
 *   possible last battle it lands such a player at the slowest refresh cadence,
 *   which is what a dormant account deserves), and
 * - **NULL**, for a row we have discovered but never fetched (perpetually due,
 *   see `computeDueAt`).
 *
 * Storage keeps them apart because the refresh policy reads them differently.
 * Anything that shows the date to a reader wants neither, so it collapses both
 * into an absence here.
 */
export function lastBattleOrNull(lastBattleAt: Date | null): Date | null {
  return lastBattleAt !== null && lastBattleAt.getTime() > 0
    ? lastBattleAt
    : null;
}
