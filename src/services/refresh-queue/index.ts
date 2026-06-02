import { and, eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { playerRefreshQueue } from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";

const CHUNK_SIZE = 500;

export type EnqueuePlayerOptions = {
  // Higher = drained sooner. Use >0 for user-initiated, 0 for cron backfill.
  priority?: number;
};

/**
 * Push players into the refresh queue. Snapshot cron drains by priority desc
 * then queued_at asc. Idempotent: a higher-priority enqueue bumps an existing
 * row up, but a lower-priority cron enqueue never downgrades a user-bumped one.
 */
export async function enqueuePlayerRefresh(
  region: Region,
  accountIds: number[],
  options: EnqueuePlayerOptions = {},
): Promise<void> {
  if (accountIds.length === 0) return;
  const priority = options.priority ?? 0;
  // Sort by id so concurrent bulk inserts grab row locks in the same order
  // (prevents Postgres 40P01 deadlocks under contention).
  const unique = Array.from(new Set(accountIds)).sort((a, b) => a - b);

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    await db
      .insert(playerRefreshQueue)
      .values(chunk.map((accountId) => ({ region, accountId, priority })))
      .onConflictDoUpdate({
        target: [playerRefreshQueue.region, playerRefreshQueue.accountId],
        set: {
          priority: sql`GREATEST(${playerRefreshQueue.priority}, EXCLUDED.priority)`,
          queuedAt: sql`LEAST(${playerRefreshQueue.queuedAt}, EXCLUDED.queued_at)`,
        },
      });
  }
}

/**
 * Fire-and-forget variant for hot paths (page renders). Logs but never throws.
 */
export function enqueuePlayerRefreshBackground(
  region: Region,
  accountIds: number[],
  options: EnqueuePlayerOptions = {},
): void {
  void enqueuePlayerRefresh(region, accountIds, options).catch((err) =>
    console.error(`[refresh-queue] enqueuePlayerRefresh ${region} failed:`, err),
  );
}

/**
 * Remove processed entries. Called by the cron worker after a successful or
 * permanently-failed refresh, so we don't loop on dead rows forever.
 */
export async function dequeuePlayerRefresh(
  region: Region,
  accountId: number,
): Promise<void> {
  await db
    .delete(playerRefreshQueue)
    .where(
      and(
        eq(playerRefreshQueue.region, region),
        eq(playerRefreshQueue.accountId, accountId),
      ),
    );
}
