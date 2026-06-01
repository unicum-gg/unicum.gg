import { and, asc, count, eq, lt, sql } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { players } from "@/services/db/schema";
import { REGIONS } from "@/services/wargaming/wot";
import {
  getAccountsWTRBatch,
  getPlayersInfoBatch,
  type PlayerInfo,
} from "@/services/wargaming/wot/accounts";
import {
  getTanksStatsBatch,
  type TankStats,
} from "@/services/wargaming/wot/tanks";
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

export async function refreshDuePlayers(): Promise<RefreshResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);

  const dueByRegion = await Promise.all(
    REGIONS.map(async (region) => {
      const where = and(
        eq(players.region, region),
        lt(players.lastSeenAt, cutoff),
      );
      const [rows, [{ queued }]] = await Promise.all([
        db
          .select()
          .from(players)
          .where(where)
          .orderBy(asc(players.lastSeenAt))
          .limit(BATCH_SIZE_PER_REGION),
        db.select({ queued: count() }).from(players).where(where),
      ]);
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
          continue;
        }
        try {
          const wtr = wtrByAccount.get(player.accountId) ?? null;
          const tanks = tanksByAccount.get(player.accountId) ?? [];
          await recordCurrentSnapshot(region, info, wtr, tanks);
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
        }
      }
    }),
  );

  console.log(`[snapshot-cron] done: ${succeeded} ok, ${failed} failed`);
  return { processed: total, succeeded, failed };
}
