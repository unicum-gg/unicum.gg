import { and, asc, count, eq, lt, sql } from "drizzle-orm";
import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { db } from "@/services/db";
import { players } from "@/services/db/schema";
import { REGIONS } from "@/services/wargaming/wot";
import {
  getAccountsWTRBatch,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { getTanksStats } from "@/services/wargaming/wot/tanks";
import { recordCurrentSnapshot } from "./player";

const SCHEDULE = "* * * * *";
const BATCH_SIZE_PER_REGION = 200;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 200;

export function startSnapshotCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await refreshDuePlayers();
    } catch (err) {
      console.error("[cron] tick failed:", err);
    }
  });
  console.log(`[cron] snapshot refresh scheduled (${SCHEDULE})`);
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
    `[cron] refreshing ${total}/${totalQueued} due (${dueByRegion
      .map((r) => `${r.region}:${r.rows.length}/${r.queued}`)
      .join(", ")})`,
  );

  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    dueByRegion.map(async ({ region, rows }) => {
      const wtrByAccount = await getAccountsWTRBatch(
        region,
        rows.map((r) => r.accountId),
      ).catch((err) => {
        console.error(`[cron] wtr batch failed (${region}):`, err);
        return new Map<number, number>();
      });

      for (const player of rows) {
        try {
          const [info, tanks] = await Promise.all([
            getPlayerInfo(region, player.accountId),
            getTanksStats(region, player.accountId),
          ]);
          if (info) {
            const wtr = wtrByAccount.get(player.accountId) ?? null;
            await recordCurrentSnapshot(region, info, wtr, tanks);
            succeeded += 1;
          }
        } catch (err) {
          failed += 1;
          console.error(
            `[cron] failed for ${player.nickname} (${region}):`,
            err,
          );
          await db
            .update(players)
            .set({ lastSeenAt: sql`NOW()` })
            .where(eq(players.id, player.id));
        }
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      }
    }),
  );

  console.log(`[cron] done: ${succeeded} ok, ${failed} failed`);
  return { processed: total, succeeded, failed };
}
