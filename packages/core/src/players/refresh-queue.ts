import { eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRefreshQueueByRegion } from "@unicum.gg/core/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

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
  const table = playerRefreshQueueByRegion[region];
  // Sort by id so concurrent bulk inserts grab row locks in the same order
  // (prevents Postgres 40P01 deadlocks under contention).
  const unique = Array.from(new Set(accountIds)).sort((a, b) => a - b);

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    await db
      .insert(table)
      .values(chunk.map((accountId) => ({ accountId, priority })))
      .onConflictDoUpdate({
        target: table.accountId,
        set: {
          priority: sql`GREATEST(${table.priority}, EXCLUDED.priority)`,
          queuedAt: sql`LEAST(${table.queuedAt}, EXCLUDED.queued_at)`,
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
  const table = playerRefreshQueueByRegion[region];
  await db.delete(table).where(eq(table.accountId, accountId));
}
