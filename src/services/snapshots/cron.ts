import { and, asc, count, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { players, playerRefreshQueue } from "@/services/db/schema";
import { dequeuePlayerRefresh } from "@/services/refresh-queue";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import {
  getAccountsWTRBatch,
  getPlayersInfoBatch,
  type PlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { getFullPlayerClanHistory } from "@/services/wargaming/wot/clans/player";
import {
  getTanksStatsBatch,
  type TankStats,
} from "@/services/wargaming/wot/tanks";
import { storePlayerClanHistory } from "./player/clan-history";
import { recordCurrentSnapshot } from "./player";

const SCHEDULE = "* * * * *";
const BATCH_SIZE_PER_REGION = 200;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

export function startSnapshotCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await refreshDuePlayers();
    } catch (err) {
      console.error("[snapshot-cron] tick failed:", err);
    }
  });
  console.log(`[snapshot-cron] snapshot refresh scheduled (${SCHEDULE})`);
}

export type RefreshResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

type DuePlayer = typeof players.$inferSelect & { fromQueue: boolean };

async function collectDuePlayers(
  region: Region,
  cutoff: Date,
  limit: number,
): Promise<{ rows: DuePlayer[]; queued: number }> {
  // 1. Drain priority queue first (user-initiated bumps, then cron backfills).
  const queueRows = await db
    .select({ accountId: playerRefreshQueue.accountId })
    .from(playerRefreshQueue)
    .where(eq(playerRefreshQueue.region, region))
    .orderBy(
      desc(playerRefreshQueue.priority),
      asc(playerRefreshQueue.queuedAt),
    )
    .limit(limit);
  const queuedIds = queueRows.map((r) => Number(r.accountId));

  const queuedPlayerRows =
    queuedIds.length > 0
      ? await db
          .select()
          .from(players)
          .where(
            and(
              eq(players.region, region),
              inArray(players.accountId, queuedIds),
            ),
          )
      : [];
  const queueResults: DuePlayer[] = queuedPlayerRows.map((p) => ({
    ...p,
    fromQueue: true,
  }));

  // 2. Fill the remaining budget with the oldest-snapshot scan, excluding
  //    players we already pulled from the queue above.
  const remaining = limit - queueResults.length;
  const staleWhere = and(
    eq(players.region, region),
    lt(players.lastSeenAt, cutoff),
    queuedIds.length > 0 ? notInArray(players.accountId, queuedIds) : undefined,
  );
  const [staleRows, [{ queued: staleCount }]] = await Promise.all([
    remaining > 0
      ? db
          .select()
          .from(players)
          .where(staleWhere)
          .orderBy(asc(players.lastSeenAt))
          .limit(remaining)
      : Promise.resolve([] as (typeof players.$inferSelect)[]),
    db.select({ queued: count() }).from(players).where(staleWhere),
  ]);
  const staleResults: DuePlayer[] = staleRows.map((p) => ({
    ...p,
    fromQueue: false,
  }));

  return {
    rows: [...queueResults, ...staleResults],
    queued: queueResults.length + staleCount,
  };
}

export async function refreshDuePlayers(): Promise<RefreshResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);

  const dueByRegion = await Promise.all(
    REGIONS.map(async (region) => {
      const { rows, queued } = await collectDuePlayers(
        region,
        cutoff,
        BATCH_SIZE_PER_REGION,
      );
      return { region, rows, queued };
    }),
  );

  const total = dueByRegion.reduce((acc, r) => acc + r.rows.length, 0);
  const totalQueued = dueByRegion.reduce((acc, r) => acc + r.queued, 0);
  if (total === 0) return { processed: 0, succeeded: 0, failed: 0 };

  console.log(
    `[snapshot-cron] refreshing ${total}/${totalQueued} due (${dueByRegion
      .map((r) => `${r.region}:${r.rows.length}/${r.queued}`)
      .join(", ")})`,
  );

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    dueByRegion.map(async ({ region, rows }) => {
      if (rows.length === 0) return;
      const accountIds = rows.map((r) => r.accountId);

      // 3 WG endpoints, all batched, all in parallel
      const [infosByAccount, tanksByAccount, wtrByAccount] = await Promise.all([
        getPlayersInfoBatch(region, accountIds).catch((err) => {
          console.error(`[snapshot-cron] account/info batch failed (${region}):`, err);
          return new Map<number, PlayerInfo>();
        }),
        getTanksStatsBatch(region, accountIds).catch((err) => {
          console.error(`[snapshot-cron] tanks/stats batch failed (${region}):`, err);
          return new Map<number, TankStats[]>();
        }),
        getAccountsWTRBatch(region, accountIds).catch((err) => {
          console.error(`[snapshot-cron] wtr batch failed (${region}):`, err);
          return new Map<number, number>();
        }),
      ]);

      for (const player of rows) {
        const info = infosByAccount.get(player.accountId);
        if (!info) {
          failed += 1;
          // Touch lastSeenAt so we don't keep retrying immediately
          await db
            .update(players)
            .set({ lastSeenAt: sql`NOW()` })
            .where(eq(players.id, player.id));
          if (player.fromQueue) {
            await dequeuePlayerRefresh(region, player.accountId);
          }
          continue;
        }
        try {
          const wtr = wtrByAccount.get(player.accountId) ?? null;
          const tanks = tanksByAccount.get(player.accountId) ?? [];
          await recordCurrentSnapshot(region, info, wtr, tanks);
          // Clan history is portal-only (no batch endpoint) and goes through
          // a Semaphore(3) per region, so we only refresh it for queued
          // entries — a user is actively viewing that player and wants
          // current clan data. Bulk cron backfills skip it; the next user
          // visit will enqueue and refresh.
          if (player.fromQueue) {
            void getFullPlayerClanHistory(region, player.accountId)
              .then((history) =>
                storePlayerClanHistory(region, player.accountId, history),
              )
              .catch((err) =>
                console.error(
                  `[snapshot-cron] clan-history refresh failed for ${player.nickname} (${region}):`,
                  err,
                ),
              );
            await dequeuePlayerRefresh(region, player.accountId);
          }
          succeeded += 1;
        } catch (err) {
          failed += 1;
          console.error(
            `[snapshot-cron] snapshot insert failed for ${player.nickname} (${region}):`,
            err,
          );
          await db
            .update(players)
            .set({ lastSeenAt: sql`NOW()` })
            .where(eq(players.id, player.id));
          if (player.fromQueue) {
            await dequeuePlayerRefresh(region, player.accountId);
          }
        }
      }
    }),
  );

  console.log(`[snapshot-cron] done: ${succeeded} ok, ${failed} failed`);
  return { processed: total, succeeded, failed };
}
