import { asc, count, eq, lt, sql } from "drizzle-orm";
import { scheduleCron } from "@/services/cron/scheduler";
import { db } from "@/services/db";
import { type Player, playersByRegion } from "@/services/db/schema";
import { REGIONS, type Region } from "@/services/wargaming/wot";
import {
  getAccountsWTRBatch,
  getPlayersInfoBatch,
  type PlayerInfo,
} from "@/services/wargaming/wot/accounts";
import {
  getTanksStatsBatch,
  type TankStats,
} from "@/services/wargaming/wot/tanks";
import { recordCurrentSnapshot } from ".";

const SCHEDULE = "* * * * * *";
const BATCH_SIZE_PER_REGION = 400;
const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Schedules one independent cron per region instead of a single cron that
 * processes all three in parallel. The single-cron design was bottlenecked
 * by EU's G-Core throttling: a slow EU tick held the global overlap guard
 * and caused NA/Asia to skip their own ticks ("previous tick still in
 * flight"). Per-region crons keep each region's overlap guard isolated, so
 * EU's timeouts can't starve NA/Asia of compute.
 */
export function startPlayerBackfillCron(): void {
  for (const region of REGIONS) {
    const name = `snapshot-cron-${region}`;
    if (
      scheduleCron(name, SCHEDULE, async () => {
        await refreshDuePlayersForRegion(region);
      })
    ) {
      console.log(`[${name}] snapshot refresh scheduled (${SCHEDULE})`);
    }
  }
}

export type RefreshResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

async function collectDuePlayers(
  region: Region,
  cutoff: Date,
  limit: number,
): Promise<{ rows: Player[]; queued: number }> {
  // Pure 24h backfill, biased toward filling holes in the DB first, then
  // toward recently-active players. NULL lastBattleAt = player discovered
  // via a clan members list with no stats yet. Until those are fetched,
  // they're missing from leaderboards / top players / search, so they
  // always take priority (NULLS FIRST). Among non-NULLs, most recent
  // battle wins so active players stay refreshed. lastSeenAt ASC breaks
  // ties so we rotate through.
  const players = playersByRegion[region];
  const where = lt(players.lastSeenAt, cutoff);
  const [rows, [{ queued }]] = await Promise.all([
    db
      .select()
      .from(players)
      .where(where)
      .orderBy(
        sql`${players.lastBattleAt} DESC NULLS FIRST`,
        asc(players.lastSeenAt),
      )
      .limit(limit),
    db.select({ queued: count() }).from(players).where(where),
  ]);
  return { rows, queued };
}

async function processRegionBatch(
  region: Region,
  rows: Player[],
): Promise<{ succeeded: number; failed: number }> {
  const players = playersByRegion[region];
  const accountIds = rows.map((r) => r.accountId);

  const [infosByAccount, tanksByAccount, wtrByAccount] = await Promise.all([
    getPlayersInfoBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-cron-${region}] account/info batch failed:`, err);
      return new Map<number, PlayerInfo>();
    }),
    getTanksStatsBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-cron-${region}] tanks/stats batch failed:`, err);
      return new Map<number, TankStats[]>();
    }),
    getAccountsWTRBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-cron-${region}] wtr batch failed:`, err);
      return new Map<number, number>();
    }),
  ]);

  let succeeded = 0;
  let failed = 0;

  for (const player of rows) {
    const info = infosByAccount.get(player.accountId);
    if (!info) {
      failed += 1;
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
        `[snapshot-cron-${region}] snapshot insert failed for ${player.nickname}:`,
        err,
      );
      await db
        .update(players)
        .set({ lastSeenAt: sql`NOW()` })
        .where(eq(players.id, player.id));
    }
  }

  return { succeeded, failed };
}

export async function refreshDuePlayersForRegion(
  region: Region,
): Promise<RefreshResult> {
  const cutoff = new Date(Date.now() - MIN_REFRESH_AGE_MS);
  const { rows, queued } = await collectDuePlayers(
    region,
    cutoff,
    BATCH_SIZE_PER_REGION,
  );
  if (rows.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

  console.log(
    `[snapshot-cron-${region}] refreshing ${rows.length}/${queued} due`,
  );

  const { succeeded, failed } = await processRegionBatch(region, rows);

  console.log(
    `[snapshot-cron-${region}] done: ${succeeded} ok, ${failed} failed`,
  );
  return { processed: rows.length, succeeded, failed };
}

/**
 * Run a single round across all three regions in parallel. Kept for the
 * manual `/api/cron/refresh-snapshots` HTTP trigger; production background
 * work goes through the per-region scheduled crons.
 */
export async function refreshDuePlayers(): Promise<RefreshResult> {
  const results = await Promise.all(
    REGIONS.map((region) => refreshDuePlayersForRegion(region)),
  );
  return results.reduce(
    (acc, r) => ({
      processed: acc.processed + r.processed,
      succeeded: acc.succeeded + r.succeeded,
      failed: acc.failed + r.failed,
    }),
    { processed: 0, succeeded: 0, failed: 0 },
  );
}
