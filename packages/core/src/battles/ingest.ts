import type { Region } from "@unicum.gg/wargaming";
import { battlesByRegion, type NewBattleRow } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Writing down the battles players' own clients report.
 *
 * Wargaming's API publishes an account's running totals and nothing about a
 * single battle: who was in it, what each of them did, which map, which
 * cluster. So a battle here exists only because somebody running the mod was
 * in it, and this module is the whole of that write path.
 *
 * **One battle reaches us from any participant, and names all thirty.** That
 * is the shape of this: `arena_unique_id` is a deduplication key, not an
 * ownership one. Two of our players in the same battle send the same battle,
 * and coverage grows by whole teams rather than one player at a time. The
 * first of them to arrive is the row we keep, because both read the same
 * server-side results and there is nothing to choose between them.
 */

/** How many battles one request may carry. A night of play is a few dozen. */
export const MAX_BATTLES_PER_UPLOAD = 25;

export type BattleIngestResult = {
  /** Battles written by this call. */
  stored: number;
  /** Battles another client had already sent. Not an error: expected. */
  known: number;
};

/**
 * The earliest battle the table can take, which is the start of last month.
 *
 * Mirrors the migration's own `date_trunc('month', now()) - interval '1 month'`
 * (see `drizzle/0120_battles.sql`): that is the first monthly partition, and a
 * battle older than it lands in the DEFAULT partition. Landing there is the
 * one way this shape fails quietly, because the write succeeds and the month
 * that row belonged to can then never be attached.
 *
 * Derived rather than a fixed number of days back, because a fixed window is
 * wrong on the days it matters: thirty days before the 1st of March is the
 * 30th of January, a month with no partition.
 */
function earliestAccepted(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );
}

/**
 * A day ahead, for the gap between Wargaming's clock and ours.
 *
 * `started_at` comes from the battle's server-side `arenaCreateTime`, so a
 * player's own clock cannot move it, and this is only here to catch nonsense.
 */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Whether this battle's start falls inside the months the table holds. */
export function startsInRange(startedAt: Date, now: Date = new Date()): boolean {
  const at = startedAt.getTime();
  if (!Number.isFinite(at)) return false;
  return (
    at >= earliestAccepted(now).getTime() &&
    at <= now.getTime() + FUTURE_TOLERANCE_MS
  );
}

/**
 * Store these battles, skipping the ones another client already sent.
 *
 * `onConflictDoNothing` on the primary key rather than an update: the two
 * senders of one battle are reporting the same server-side results, so there
 * is no newer version to prefer, and a write that does nothing costs one index
 * probe. The conflict target is `(started_at, arena_unique_id)` because the
 * table is partitioned on the first of those, which Postgres requires inside
 * every unique constraint; both senders derive `started_at` from the same
 * `arenaCreateTime`, so they land on the same key in the same partition.
 *
 * Inserted in one statement, so a batch is one round trip. `returning` the
 * key tells us which rows were actually new, which is the number the mod needs
 * to decide what to drop from its queue.
 *
 * The batch is deduplicated first. `DO NOTHING` tolerates a key repeated
 * inside one statement where `DO UPDATE` would refuse it, so this is not
 * about the insert succeeding: it is about `known` staying truthful, since the
 * count below reads it as "somebody else had already sent this".
 */
export async function recordBattles(
  region: Region,
  battles: NewBattleRow[],
): Promise<BattleIngestResult> {
  const unique = new Map(
    battles.map((battle) => [battle.arenaUniqueId, battle]),
  );
  const rows = [...unique.values()];
  if (rows.length === 0) return { stored: 0, known: 0 };
  const table = battlesByRegion[region];
  const written = await db
    .insert(table)
    .values(rows)
    .onConflictDoNothing({
      target: [table.startedAt, table.arenaUniqueId],
    })
    .returning({ arenaUniqueId: table.arenaUniqueId });
  return { stored: written.length, known: rows.length - written.length };
}
