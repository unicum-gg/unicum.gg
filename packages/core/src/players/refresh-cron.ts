import { asc, desc, eq } from "drizzle-orm";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import {
  playerRefreshQueueByRegion,
  playersByRegion,
} from "@unicum.gg/core/db/schema";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";
import {
  getAccountWTR,
  getPlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { getTanksStats } from "@unicum.gg/core/wargaming/wot/tanks";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "./clan-history";
import { recordCurrentSnapshot } from ".";
import { dequeuePlayerRefresh } from "./refresh-queue";

// 10s tick — fast enough for user-initiated refreshes to feel live,
// loose enough to coalesce bursts on the same player into a single drain.
const SCHEDULE = "* * * * * *";
const BATCH_SIZE_PER_REGION = 25;

/**
 * Schedules one independent cron per region so a slow region can't starve
 * the others. EU's G-Core throttling no longer cascades into NA/Asia
 * skipping their own ticks ("previous still in flight").
 */
export function startPlayerRefreshCron(): void {
  for (const region of REGIONS) {
    const name = `player-cron-${region}`;
    if (
      scheduleCron(name, SCHEDULE, async () => {
        await drainPlayerRefreshQueueForRegion(region);
      })
    ) {
      console.log(`[${name}] queue drain scheduled (${SCHEDULE})`);
    }
  }
}

type QueueEntry = {
  region: Region;
  accountId: number;
  playerId: number;
  nickname: string;
};

async function pickEntriesForRegion(
  region: Region,
  limit: number,
): Promise<QueueEntry[]> {
  // Pull queue entries by priority, then join the regional players table to
  // get id/nickname for logging + the recordCurrentSnapshot path. Players in
  // the queue but missing from `<region>_players` are skipped here — they're
  // cold-path territory (the page itself does the sync fetch for first-ever
  // visits).
  const queue = playerRefreshQueueByRegion[region];
  const players = playersByRegion[region];
  const rows = await db
    .select({
      accountId: queue.accountId,
      playerId: players.id,
      nickname: players.nickname,
    })
    .from(queue)
    .innerJoin(players, eq(players.accountId, queue.accountId))
    .orderBy(desc(queue.priority), asc(queue.queuedAt))
    .limit(limit);

  return rows.map((r) => ({
    region,
    accountId: Number(r.accountId),
    playerId: Number(r.playerId),
    nickname: r.nickname,
  }));
}

async function refreshOne(entry: QueueEntry): Promise<boolean> {
  const { region, accountId } = entry;
  try {
    const [info, tanks, wtr, history] = await Promise.all([
      getPlayerInfo(region, accountId),
      getTanksStats(region, accountId),
      getAccountWTR(region, accountId).catch(() => null),
      loadPlayerClanHistoryFromWG(region, accountId).catch((err) => {
        // Portal is flaky — don't fail the whole refresh on history alone.
        console.warn(
          `[player-cron-${region}] clan-history failed for ${entry.nickname}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }),
    ]);

    if (!info) return false;

    // recordCurrentSnapshot publishes a "snapshot" event on playerChannel,
    // so any open SSE connection will be notified to refetch.
    await recordCurrentSnapshot(region, info, wtr, tanks);
    if (history) {
      await storePlayerClanHistory(region, accountId, history);
    }
    return true;
  } catch (err) {
    console.error(
      `[player-cron-${region}] refresh ${entry.nickname} failed:`,
      err,
    );
    return false;
  }
}

export async function drainPlayerRefreshQueueForRegion(
  region: Region,
): Promise<void> {
  const entries = await pickEntriesForRegion(region, BATCH_SIZE_PER_REGION);
  if (entries.length === 0) return;

  let ok = 0;
  let failed = 0;

  await Promise.all(
    entries.map(async (entry) => {
      const success = await refreshOne(entry);
      if (success) ok += 1;
      else failed += 1;
      // Always dequeue — failures are logged, and the snapshot-cron 24h
      // backfill will eventually retry stale players. We don't want a
      // poisoned entry blocking the queue forever.
      await dequeuePlayerRefresh(entry.region, entry.accountId);
    }),
  );

  console.log(
    `[player-cron-${region}] drained ${entries.length} (${ok} ok, ${failed} failed)`,
  );
}
