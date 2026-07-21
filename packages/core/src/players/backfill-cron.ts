import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { tryAcquireLease } from "@unicum.gg/core/cron/lease";
import { db } from "@unicum.gg/core/db";
import { type Player, playersByRegion } from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
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

// Players fetched per chunk. Kept at the WG batch granularity so one chunk is
// still a handful of batched requests (info /100, tanks/stats /25, wtr /100),
// not one request per player.
const FETCH_CHUNK = 100;
// Chunks processed concurrently per region. This is the pipeline: N workers each
// claim a chunk straight from the DB and run fetch -> write in a tight loop, so
// one worker's slow WG wait overlaps the others' fetches/writes instead of
// stalling the whole region. N concurrent fetches also actually use the WG budget
// (a single serial batch left ~80% of it idle). Bounded so N x WRITE_CONCURRENCY
// writers stay within the background DB pool. There is NO intermediate work queue:
// the players table + the `eu_players_due_idx` index IS the durable queue, so a
// restart loses nothing beyond the chunk a worker is mid-processing.
//
// Sized to clear the on-time backlog (EU needs ~385k refreshes/day, see
// /coverage) WITHOUT overloading Postgres. The per-player write path
// (recordCurrentSnapshot's d30 + carryForward read-backs on the 300M-row
// tank_snapshots table) is the real cost and scales super-linearly with
// concurrency: at 3 workers Postgres sat at ~31% CPU, at 8 it spiked to ~530%
// (host load 15). 4 keeps a healthy margin above the ~3-worker throughput while
// staying well under the host's 8 cores. Going higher needs that write path
// optimized first, not more workers.
const PIPELINE_CONCURRENCY = 4;
// Per-player write fan-out inside a chunk. Total concurrent writers is roughly
// REGIONS x PIPELINE_CONCURRENCY x WRITE_CONCURRENCY; with NA/Asia usually drained
// (only EU busy) that's ~8 x 2 = 16, within the background DB pool (writes release
// their connection between queries, so this is a peak, not a sustained hold).
const WRITE_CONCURRENCY = 2;
// Back-off when a region's due queue is momentarily empty, or after an error.
// A drained region's workers grow their idle sleep exponentially up to the cap so
// they stop hammering the DB with claim scans that find nothing.
const IDLE_SLEEP_MS = 2_000;
const MAX_IDLE_SLEEP_MS = 30_000;
const ERROR_BACKOFF_MS = 5_000;
// Re-check the leader lease this often (lease itself lasts 90s).
const LEASE_REFRESH_MS = 30_000;
// Soft-delete tunables — see schema/players.ts for the rationale.
const NULL_THRESHOLD = 3;
const SOFT_DELETE_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;

const SKIP_LEASE = process.env.NODE_ENV === "development";
const SKIP_CRONS = process.env.SKIP_CRONS === "true";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Cached leader flag, refreshed on an interval so the N workers don't each hit
// the lease row every iteration. Only the leader instance processes; others idle.
let isLeader = SKIP_LEASE;
async function refreshLease(): Promise<void> {
  if (SKIP_LEASE) return;
  try {
    isLeader = await tryAcquireLease();
  } catch {
    // Keep the last known state on a transient DB blip rather than flipping.
  }
}

/**
 * Continuous per-region snapshot pipeline. Instead of a cron tick that runs one
 * batch to completion (fetch, THEN write) before the next tick — which left the
 * pipeline idle during the WG wait and used a fraction of the WG budget — each
 * region runs `PIPELINE_CONCURRENCY` persistent workers. Every worker atomically
 * claims a chunk of due players (bumping `last_seen_at` under FOR UPDATE SKIP
 * LOCKED so two workers never grab the same rows), fetches + writes it, and
 * immediately claims the next. Fetches and writes overlap continuously.
 */
export function startPlayerBackfillCron(): void {
  if (SKIP_CRONS) {
    console.log(`[snapshot-pipeline] SKIP_CRONS=true, not starting`);
    return;
  }
  void refreshLease();
  setInterval(() => void refreshLease(), LEASE_REFRESH_MS);
  // Throughput accounting, logged once a minute instead of per chunk (chunks now
  // complete several times a second across the pool).
  setInterval(() => {
    for (const region of REGIONS) {
      const s = stats[region];
      if (s && s.chunks > 0) {
        console.log(
          `[snapshot-pipeline-${region}] last 60s: ${s.ok} ok, ${s.failed} failed, ${s.chunks} chunks`,
        );
        stats[region] = { ok: 0, failed: 0, chunks: 0 };
      }
    }
  }, 60_000);
  for (const region of REGIONS) {
    for (let i = 0; i < PIPELINE_CONCURRENCY; i++) {
      void regionWorker(region, i);
    }
  }
  console.log(
    `[snapshot-pipeline] started: ${PIPELINE_CONCURRENCY} workers x ${REGIONS.length} regions, ${FETCH_CHUNK}/chunk`,
  );
}

// Lightweight per-region throughput accounting for the once-a-minute log above.
const stats: Record<string, { ok: number; failed: number; chunks: number }> =
  {};
function bump(region: Region, ok: number, failed: number): void {
  const s = (stats[region] ??= { ok: 0, failed: 0, chunks: 0 });
  s.ok += ok;
  s.failed += failed;
  s.chunks += 1;
}

async function regionWorker(region: Region, workerIdx: number): Promise<void> {
  // Persistent loop: never returns for the process lifetime. Each iteration
  // claims one chunk straight from the DB and processes it end-to-end; errors are
  // isolated so the worker self-heals. No in-memory buffer — the claim IS the
  // dequeue, so nothing is stranded in memory across a restart.
  let emptyStreak = 0;
  for (;;) {
    try {
      if (!isLeader) {
        await sleep(LEASE_REFRESH_MS);
        continue;
      }
      const rows = await claimDuePlayers(region, FETCH_CHUNK);
      if (rows.length === 0) {
        // Region caught up. Back off exponentially so a drained region (e.g.
        // NA/Asia, whose queues are usually empty) doesn't hammer the DB with
        // claim scans that find nothing — that polling was a big chunk of the
        // Postgres load. Reset to a tight loop the moment work reappears.
        emptyStreak += 1;
        await sleep(Math.min(IDLE_SLEEP_MS * 2 ** emptyStreak, MAX_IDLE_SLEEP_MS));
        continue;
      }
      emptyStreak = 0;
      const { succeeded, failed } = await processRegionBatch(region, rows);
      bump(region, succeeded, failed);
    } catch (err) {
      console.error(
        `[snapshot-pipeline-${region}] worker ${workerIdx} error:`,
        err,
      );
      await sleep(ERROR_BACKOFF_MS);
    }
  }
}

export type RefreshResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

/**
 * Atomically claim up to `limit` due players for one worker.
 *
 * Adaptive cadence — see refresh-policy.ts: the cutoff is per-row from
 * `last_battle_at` (actives every few hours, dormants weeks-to-months,
 * `last_battle_at IS NULL` — discovered via clan walk, never fetched — is
 * perpetually due). ORDER BY puts unfetched first, then most-recently-active,
 * then oldest `last_seen_at` for fairness.
 *
 * The claim is a single UPDATE that bumps `last_seen_at` on the selected rows
 * under `FOR UPDATE SKIP LOCKED`, so the region's concurrent workers never grab
 * the same players. Bumping `last_seen_at` IS the claim: the row instantly drops
 * out of the "due" predicate, so there's no double-processing even before the
 * (later) snapshot write. `recordCurrentSnapshot` re-stamps it on success; the
 * null/error paths update it too. A crash between claim and write just lets those
 * players wait one cadence — acceptable, and rare.
 */
async function claimDuePlayers(
  region: Region,
  limit: number,
): Promise<Player[]> {
  const players = playersByRegion[region];
  // Skip players WG keeps returning null for, if soft-deleted within the recheck
  // window; after it the OR branch lets them back in for one retry.
  const softDeleteCutoff = new Date(Date.now() - SOFT_DELETE_RECHECK_MS);
  const where = and(
    sql`${players.lastSeenAt} < ${refreshCutoffSql(players.lastBattleAt)}`,
    or(
      isNull(players.softDeletedAt),
      lt(players.softDeletedAt, softDeleteCutoff),
    ),
  );
  const claimIds = db
    .select({ id: players.id })
    .from(players)
    .where(where)
    .orderBy(
      sql`${players.lastBattleAt} DESC NULLS FIRST`,
      asc(players.lastSeenAt),
    )
    .limit(limit)
    .for("update", { skipLocked: true });
  return db
    .update(players)
    .set({ lastSeenAt: sql`NOW()` })
    .where(inArray(players.id, claimIds))
    .returning();
}

async function processRegionBatch(
  region: Region,
  rows: Player[],
): Promise<{ succeeded: number; failed: number }> {
  const players = playersByRegion[region];
  const accountIds = rows.map((r) => r.accountId);

  const [infosByAccount, tanksByAccount, wtrByAccount] = await Promise.all([
    getPlayersInfoBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-pipeline-${region}] account/info batch failed:`, err);
      return new Map<number, PlayerInfo>();
    }),
    getTanksStatsBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-pipeline-${region}] tanks/stats batch failed:`, err);
      return new Map<number, TankStats[]>();
    }),
    getAccountsWTRBatch(region, accountIds).catch((err) => {
      console.error(`[snapshot-pipeline-${region}] wtr batch failed:`, err);
      return new Map<number, number>();
    }),
  ]);

  let succeeded = 0;
  let failed = 0;

  // Record one player's snapshot (or handle its WG-null / error case). Fully
  // self-contained per player so it is safe to run several at once; the counters
  // are plain increments (JS is single-threaded, so no atomicity concern between
  // awaits).
  const processOne = async (player: Player): Promise<void> => {
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
      return;
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
        `[snapshot-pipeline-${region}] snapshot insert failed for ${player.nickname}:`,
        err,
      );
      await db
        .update(players)
        .set({ lastSeenAt: sql`NOW()` })
        .where(eq(players.id, player.id));
    }
  };

  // Bounded concurrency: `WRITE_CONCURRENCY` workers each drain a round-robin
  // slice of the batch serially. Steady N-way parallelism with no per-chunk
  // barrier (a slow player never blocks a whole chunk). Each row maps to exactly
  // one worker, so no player is processed twice.
  const lanes: Player[][] = Array.from({ length: WRITE_CONCURRENCY }, () => []);
  rows.forEach((player, i) => lanes[i % WRITE_CONCURRENCY].push(player));
  await Promise.all(
    lanes.map(async (lane) => {
      for (const player of lane) await processOne(player);
    }),
  );

  return { succeeded, failed };
}

export async function refreshDuePlayersForRegion(
  region: Region,
): Promise<RefreshResult> {
  const rows = await claimDuePlayers(region, FETCH_CHUNK);
  if (rows.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

  const { succeeded, failed } = await processRegionBatch(region, rows);
  return { processed: rows.length, succeeded, failed };
}

/**
 * Run a single chunk across all three regions in parallel. Kept for the
 * manual `/api/cron/refresh-snapshots` HTTP trigger; production background work
 * goes through the continuous per-region pipeline (`startPlayerBackfillCron`).
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
