import { eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { clanRefreshQueueByRegion } from "@/services/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";

const CHUNK_SIZE = 500;

export type EnqueueClanOptions = {
  // Higher = drained sooner. Use >0 for user-initiated, 0 for discovery.
  priority?: number;
};

/**
 * Push clans into the refresh queue. The refresh-cron drains by priority
 * desc then queued_at asc. Idempotent: a higher-priority enqueue bumps an
 * existing row up, but a lower-priority discovery enqueue never downgrades
 * a user-bumped one.
 */
export async function enqueueClanRefresh(
  region: Region,
  clanIds: number[],
  options: EnqueueClanOptions = {},
): Promise<void> {
  if (clanIds.length === 0) return;
  const priority = options.priority ?? 0;
  const table = clanRefreshQueueByRegion[region];
  // Sort by id so concurrent bulk inserts grab row locks in the same order
  // (prevents Postgres 40P01 deadlocks under contention).
  const unique = Array.from(new Set(clanIds)).sort((a, b) => a - b);

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    await db
      .insert(table)
      .values(chunk.map((clanId) => ({ clanId, priority })))
      .onConflictDoUpdate({
        target: table.clanId,
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
export function enqueueClanRefreshBackground(
  region: Region,
  clanIds: number[],
  options: EnqueueClanOptions = {},
): void {
  void enqueueClanRefresh(region, clanIds, options).catch((err) =>
    console.error(`[refresh-queue] enqueueClanRefresh ${region} failed:`, err),
  );
}

/**
 * Remove processed entries. Called by the refresh-cron after a successful or
 * permanently-failed refresh, so we don't loop on dead rows forever.
 */
export async function dequeueClanRefresh(
  region: Region,
  clanId: number,
): Promise<void> {
  const table = clanRefreshQueueByRegion[region];
  await db.delete(table).where(eq(table.clanId, clanId));
}
