import { and, asc, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { db } from "@unicum.gg/core/db";
import { type Player, playersByRegion } from "@unicum.gg/core/db/schema";
import { REGIONS, type Region } from "@unicum.gg/wargaming/region";
import {
  getAccountsWTRBatch,
  getPlayersInfoBatch,
  type PlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import {
  getTanksStatsBatch,
  type TankStats,
} from "@unicum.gg/core/wargaming/wot/tanks";
import { recordCurrentSnapshot } from ".";
import { refreshCutoffSql } from "./refresh-policy";

const SCHEDULE = "* * * * * *";
const BATCH_SIZE_PER_REGION = 400;
// Soft-delete tunables — see schema/players.ts for the rationale.
const NULL_THRESHOLD = 3;
const SOFT_DELETE_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;

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
  limit: number,
): Promise<{ rows: Player[]; queued: number }> {
  // Adaptive cadence — see refresh-policy.ts for the per-bucket targets.
  // The cutoff is computed per-row from `last_battle_at`: actives get
  // refreshed every few hours, dormants every weeks-to-months, and
  // `last_battle_at IS NULL` (= we know the account from clan discovery
  // but never called /wot/account/info/) is perpetually due so it dominates
  // the queue until cleared.
  //
  // ORDER BY puts unfetched first (NULLS FIRST), then most-recently-active,
  // then oldest `last_seen_at` for fairness within ties. This keeps the
  // discovery backlog clearing fast while still rotating fetched players.
  const players = playersByRegion[region];
  // Skip players that WG has been returning null for if we already marked
  // them soft-deleted within the past 30 days. After the recheck window the
  // OR branch lets them back in; if WG keeps returning null we re-stamp
  // softDeletedAt and they go back to sleep.
  const softDeleteCutoff = new Date(
    Date.now() - SOFT_DELETE_RECHECK_MS,
  );
  const where = and(
    sql`${players.lastSeenAt} < ${refreshCutoffSql(players.lastBattleAt)}`,
    or(
      isNull(players.softDeletedAt),
      lt(players.softDeletedAt, softDeleteCutoff),
    ),
  );
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
      // WG returned null. Bump the null counter; if we cross the threshold,
      // stamp `softDeletedAt` so we stop hammering this account for 30 days.
      // The threshold guards against transient null responses on otherwise
      // active accounts (observed empirically).
      failed += 1;
      const nextCount = (player.nullCount ?? 0) + 1;
      await db
        .update(players)
        .set({
          lastSeenAt: sql`NOW()`,
          nullCount: nextCount,
          softDeletedAt:
            nextCount >= NULL_THRESHOLD ? sql`NOW()` : players.softDeletedAt,
        })
        .where(eq(players.id, player.id));
      continue;
    }
    try {
      const wtr = wtrByAccount.get(player.accountId) ?? null;
      const tanks = tanksByAccount.get(player.accountId) ?? [];
      // fetchMarks=false: the bulk backfill must not spend the 1 RPS/region
      // portal budget per player — that serialises snapshot writes and starves
      // on-time freshness. Marks are carried forward and refreshed on-demand.
      await recordCurrentSnapshot(region, info, wtr, tanks, false);
      succeeded += 1;
      // Successful fetch wipes the soft-delete state. Necessary so a
      // previously-flagged account that came back can rejoin the rotation
      // without waiting another full recheck window.
      if ((player.nullCount ?? 0) > 0 || player.softDeletedAt) {
        await db
          .update(players)
          .set({ nullCount: 0, softDeletedAt: null })
          .where(eq(players.id, player.id));
      }
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
  const { rows, queued } = await collectDuePlayers(
    region,
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
