import { asc, desc, eq } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { playerRefreshQueue, players } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import {
  getAccountWTR,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { getTanksStats } from "@/services/wargaming/wot/tanks";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
} from "./clan-history";
import { recordCurrentSnapshot } from ".";
import { dequeuePlayerRefresh } from "./refresh-queue";

// 10s tick — fast enough for user-initiated refreshes to feel live,
// loose enough to coalesce bursts on the same player into a single drain.
const SCHEDULE = "*/10 * * * * *";
const BATCH_SIZE_PER_REGION = 25;

export function startPlayerRefreshCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await drainPlayerRefreshQueue();
    } catch (err) {
      console.error("[player-cron] tick failed:", err);
    }
  });
  console.log(`[player-cron] queue drain scheduled (${SCHEDULE})`);
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
  // Pull queue entries by priority, then join `players` to get id/nickname
  // for logging + the recordCurrentSnapshot path. Players in the queue but
  // missing from `players` are skipped here — they're cold-path territory
  // (the page itself does the sync fetch for first-ever visits).
  const rows = await db
    .select({
      region: playerRefreshQueue.region,
      accountId: playerRefreshQueue.accountId,
      playerId: players.id,
      nickname: players.nickname,
    })
    .from(playerRefreshQueue)
    .innerJoin(
      players,
      eq(players.accountId, playerRefreshQueue.accountId),
    )
    .where(eq(playerRefreshQueue.region, region))
    .orderBy(
      desc(playerRefreshQueue.priority),
      asc(playerRefreshQueue.queuedAt),
    )
    .limit(limit);

  return rows.map((r) => ({
    region: r.region as Region,
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
          `[player-cron] clan-history failed for ${entry.nickname} (${region}):`,
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
      `[player-cron] refresh ${entry.nickname} (${region}) failed:`,
      err,
    );
    return false;
  }
}

export async function drainPlayerRefreshQueue(): Promise<void> {
  const perRegion = await Promise.all(
    REGIONS.map((region) =>
      pickEntriesForRegion(region, BATCH_SIZE_PER_REGION),
    ),
  );
  const total = perRegion.reduce((a, e) => a + e.length, 0);
  if (total === 0) return;

  let ok = 0;
  let failed = 0;

  await Promise.all(
    perRegion.flat().map(async (entry) => {
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
    `[player-cron] drained ${total} (${ok} ok, ${failed} failed)`,
  );
}
