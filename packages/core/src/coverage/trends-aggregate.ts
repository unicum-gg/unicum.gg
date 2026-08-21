import { sql } from "drizzle-orm";
import { coverageTrendsByRegion, playerSnapshotsByRegion } from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";

/**
 * Precompute the /coverage snapshot-trend aggregates off the request path.
 *
 * The three source queries (a rolling 24h count and two 30-day daily
 * histograms, the per-player MIN(taken_at) CTE being the ~24s heaviest) are
 * full seq-scans of the 10M+ row *_player_snapshots tables. They have no cheap
 * `players`-table proxy, so on the request path a cold cache let a thundering
 * herd fire several of them concurrently and saturate the shared host's CPU/IO,
 * which is what drags every other DB read (loadPlayerInitialData, the
 * leaderboard boards) into the seconds at peak. This cron runs them once an
 * hour into the singleton `${region}_coverage_trends` row so /coverage reads a
 * single cheap row instead. The read never falls back to the scan, so the herd
 * is structurally gone, not just cached over.
 */

// Its own free minute, out of the way of the :00 leaderboard recompute and the
// :30 tank-ratings rollup. This project has already had the shared DB fall over
// under an hourly recompute burst, so DB-only recomputes deliberately stagger.
const COVERAGE_TRENDS_SCHEDULE = "15 * * * *";

// Must match the read path's `buildDaySeries` window in the coverage service:
// the cron fetches this many days of raw buckets, the reader renders the same
// dense window anchored to its own "today".
const DAYS_WINDOW = 30;

// Application-level single-flight, per region. The cron_leader lease and
// scheduleCron's in-flight guard already stop a second TICK, but they cannot
// stop the boot seed (`runInitialIfEmpty`) from racing the first scheduled tick
// for the same region inside one process — both call recompute. Coalescing here
// guarantees the ~24s scan for a region never runs twice at once.
const inFlight = new Map<Region, Promise<void>>();

/**
 * Recompute one region's trends row: run the three heavy reads, then replace
 * the singleton row inside one transaction (delete + insert, like the
 * leaderboard materializers). Stores the histogram buckets raw so the reader
 * re-anchors the window; the return shape stays the service's concern.
 */
export function recomputeCoverageTrends(region: Region): Promise<void> {
  const existing = inFlight.get(region);
  if (existing) return existing;

  const p = (async () => {
    const t = playerSnapshotsByRegion[region];
    const target = coverageTrendsByRegion[region];
    const [last24h, dailyRows, firstsRows] = await Promise.all([
      db
        .execute<{ count: string }>(
          sql`SELECT COUNT(*)::text AS count FROM ${t} WHERE taken_at > NOW() - INTERVAL '24 hours'`,
        )
        .then((r) => Number(r[0]?.count ?? 0)),
      db.execute<{ day: string; count: string }>(
        sql`SELECT date_trunc('day', taken_at)::text AS day, COUNT(*)::text AS count
            FROM ${t}
            WHERE taken_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
            GROUP BY day
            ORDER BY day`,
      ),
      db.execute<{ day: string; count: string }>(
        sql`WITH firsts AS (
              SELECT player_id, MIN(taken_at) AS first_at
              FROM ${t}
              GROUP BY player_id
            )
            SELECT date_trunc('day', first_at)::text AS day, COUNT(*)::text AS count
            FROM firsts
            WHERE first_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
            GROUP BY day
            ORDER BY day`,
      ),
    ]);

    await db.transaction(async (tx) => {
      await tx.delete(target);
      await tx.insert(target).values({
        id: 1,
        playerSnapshotsLast24h: last24h,
        playerSnapshotsDaily: dailyRows.map((r) => ({ day: r.day, count: r.count })),
        firstSnapshotsDaily: firstsRows.map((r) => ({ day: r.day, count: r.count })),
      });
    });
  })().finally(() => inFlight.delete(region));

  inFlight.set(region, p);
  return p;
}

/**
 * Recompute every region SEQUENTIALLY. The whole point is to serialize this
 * cost off the request path, so the three regions' heavy scans must never stack
 * concurrently on the shared pool. One region's failure is logged, not fatal.
 * Returns how many regions succeeded.
 */
export async function refreshCoverageTrends(): Promise<number> {
  let ok = 0;
  for (const region of REGIONS) {
    try {
      const start = Date.now();
      await recomputeCoverageTrends(region);
      ok++;
      console.log(
        `[coverage-trends-cron] ${region} recomputed in ${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error(`[coverage-trends-cron] ${region} failed:`, err);
    }
  }
  return ok;
}

// Seed on boot so the table isn't empty (and /coverage's growth curves flat at
// zero) for up to an hour after a fresh deploy. Only regions with no row yet.
async function runInitialIfEmpty(): Promise<void> {
  try {
    for (const region of REGIONS) {
      const table = coverageTrendsByRegion[region];
      const existing = await db.select({ id: table.id }).from(table).limit(1);
      if (existing.length > 0) continue;
      console.log(`[coverage-trends-cron] ${region} empty, seeding`);
      try {
        await recomputeCoverageTrends(region);
      } catch (err) {
        console.error(`[coverage-trends-cron] ${region} seed failed:`, err);
      }
    }
  } catch (err) {
    console.error("[coverage-trends-cron] initial seed failed:", err);
  }
}

export function startCoverageTrendsCron(): void {
  if (
    scheduleCron("coverage-trends-cron", COVERAGE_TRENDS_SCHEDULE, async () => {
      const n = await refreshCoverageTrends();
      console.log(
        `[coverage-trends-cron] refreshed ${n}/${REGIONS.length} regions`,
      );
    })
  ) {
    console.log(`[coverage-trends-cron] scheduled (${COVERAGE_TRENDS_SCHEDULE})`);
    void runInitialIfEmpty();
  }
}
