import { eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRefreshQueueByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const CHUNK_SIZE = 500;

// Priority a live page view enqueues at (drained before page-hit priority 10
// and cron backfill priority 0).
export const LIVE_REFRESH_PRIORITY = 20;

// How many players may sit in the live lane at once.
//
// The lane is a fixed-rate consumer behind an unbounded producer, so without a
// bound it can only ever grow. The rate is NOT the WG API's: a live refresh
// reads marks through the clan portal, which is 1 rps per region spread over
// the egress lanes, so EU drains 2.07/s (measured 2026-10-19, against the
// 2.00/s the two lanes allow). Every page view whose player is over
// `FRESH_MS` old enqueues here, and a crawler that walks distinct players
// enqueues on every single view, so arrivals reached 4.2/s and the lane grew
// permanently: 86,682 entries to 140,595 over two days, oldest 25 hours, and
// an estimated wait of 43 HOURS on a lane whose whole purpose is to answer the
// reader currently looking at the page.
//
// 250 is two minutes of drain at 2.07/s, which is `MAX_ETA_SECONDS` on the
// endpoint that reports the wait: past that the countdown is a number nobody
// waits for. Bounding it is what makes the lane fast again rather than fair,
// and nothing is lost by refusing admission: `snapshot-pipeline` refreshes
// every tracked player on its own cadence and does not go through the portal.
export const LIVE_QUEUE_MAX = 250;

export type EnqueuePlayerOptions = {
  // Higher = drained sooner. Use >0 for user-initiated, 0 for cron backfill.
  priority?: number;
};

export type EnqueuePlayerResult = {
  // Players newly inserted into the queue.
  admitted: number;
  // Players already queued whose priority this call raised.
  bumped: number;
  // True when the live lane was full, so no new player was admitted. The caller
  // reports a wait only for players it actually queued.
  laneFull: boolean;
};

/**
 * Push players into the refresh queue. Snapshot cron drains by priority desc
 * then queued_at asc. Idempotent: a higher-priority enqueue bumps an existing
 * row up, but a lower-priority cron enqueue never downgrades a user-bumped one.
 *
 * A live-priority call is admission-controlled on `LIVE_QUEUE_MAX`. When the
 * lane is full it still BUMPS players already in the queue, since that costs no
 * row and is exactly the reader's request, and only refuses to add new ones.
 */
export async function enqueuePlayerRefresh(
  region: Region,
  accountIds: number[],
  options: EnqueuePlayerOptions = {},
): Promise<EnqueuePlayerResult> {
  const empty = { admitted: 0, bumped: 0, laneFull: false };
  if (accountIds.length === 0) return empty;
  const priority = options.priority ?? 0;
  const table = playerRefreshQueueByRegion[region];
  // Sort by id so concurrent bulk inserts grab row locks in the same order
  // (prevents Postgres 40P01 deadlocks under contention).
  const unique = Array.from(new Set(accountIds)).sort((a, b) => a - b);

  if (priority >= LIVE_REFRESH_PRIORITY) {
    // One index-only count on (priority, queued_at), and only on this path, so
    // the cron's bulk enqueues pay nothing for it.
    const [row] = await db
      .select({ depth: sql<number>`cast(count(*) as int)` })
      .from(table)
      .where(gte(table.priority, LIVE_REFRESH_PRIORITY));
    const depth = row?.depth ?? 0;
    if (depth >= LIVE_QUEUE_MAX) {
      const bumped = await bumpExisting(region, unique, priority);
      return { admitted: 0, bumped, laneFull: true };
    }
    // Admit only up to the ceiling. The slice is by account id rather than by
    // caller order, which is fine: a live call carries one player.
    const room = LIVE_QUEUE_MAX - depth;
    if (unique.length > room) {
      const bumped = await bumpExisting(region, unique.slice(room), priority);
      await insertChunked(region, unique.slice(0, room), priority);
      return { admitted: room, bumped, laneFull: true };
    }
  }

  await insertChunked(region, unique, priority);
  return { admitted: unique.length, bumped: 0, laneFull: false };
}

async function insertChunked(
  region: Region,
  accountIds: number[],
  priority: number,
): Promise<void> {
  const table = playerRefreshQueueByRegion[region];
  for (let i = 0; i < accountIds.length; i += CHUNK_SIZE) {
    const chunk = accountIds.slice(i, i + CHUNK_SIZE);
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
 * Raise the priority of players ALREADY queued, inserting nothing. This is the
 * full-lane path: an upsert would admit the rows the ceiling just refused,
 * since `ON CONFLICT` only fires when the row is already there.
 */
async function bumpExisting(
  region: Region,
  accountIds: number[],
  priority: number,
): Promise<number> {
  if (accountIds.length === 0) return 0;
  const table = playerRefreshQueueByRegion[region];
  let bumped = 0;
  for (let i = 0; i < accountIds.length; i += CHUNK_SIZE) {
    const chunk = accountIds.slice(i, i + CHUNK_SIZE);
    const rows = await db
      .update(table)
      .set({ priority: sql`GREATEST(${table.priority}, ${priority})` })
      .where(inArray(table.accountId, chunk))
      .returning({ accountId: table.accountId });
    bumped += rows.length;
  }
  return bumped;
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
