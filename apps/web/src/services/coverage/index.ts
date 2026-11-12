import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clanRefreshQueueByRegion,
  clansByRegion,
  coverageStatsByRegion,
  playerRefreshQueueByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getCoverageStatsUncached, type CoverageScan } from "./scan";

/**
 * What a reader is served: the region's measurement, plus the instant it was
 * taken at.
 *
 * `computedAt` is read off the materialized row rather than from the clock, so
 * the page states the age of what it is showing instead of implying it is live.
 * It is not part of {@link CoverageScan} because it belongs to the row the scan
 * is written into, not to the scan.
 */
export type CoverageStats = CoverageScan & { computedAt: Date };

// How long a materialized row stands before a reader schedules its replacement.
// An hour, which is exactly what the cache this replaces always claimed and
// never delivered.
const STATS_TTL_MS = 60 * 60 * 1000;

// How long a claimed refresh may run before another reader may claim it again.
// Generous against the ~20s the scans take, so a worker killed mid-refresh
// costs one stale window rather than wedging the row for good.
const REFRESH_LEASE_MS = 5 * 60 * 1000;

/**
 * Run the scans and replace the region's singleton row.
 *
 * `computed_at` is stamped here, after the work, and never by the claim below.
 * It is what the page prints, so a row marked fresh while it still holds the
 * previous hour's figures would be the one lie this whole change exists to stop
 * telling.
 */
async function recomputeCoverageStats(region: Region): Promise<CoverageStats> {
  const table = coverageStatsByRegion[region];
  const payload = await getCoverageStatsUncached(region);
  const computedAt = new Date();
  await db
    .insert(table)
    .values({ id: 1, payload, computedAt, refreshStartedAt: null })
    .onConflictDoUpdate({
      target: table.id,
      set: { payload, computedAt, refreshStartedAt: null },
    });
  return { ...payload, computedAt };
}

/**
 * Take the refresh for this region, or decline because somebody already holds
 * it.
 *
 * One conditional UPDATE, so the five web workers that reach the same expiry
 * together settle it in Postgres instead of each starting its own set of
 * full-table scans. The `unstable_cache` this replaces had no equivalent, which
 * is how a single expiry put a dozen concurrent scans on the database.
 */
async function claimCoverageRefresh(region: Region): Promise<boolean> {
  const table = coverageStatsByRegion[region];
  const now = Date.now();
  const claimed = await db
    .update(table)
    .set({ refreshStartedAt: new Date(now) })
    .where(
      and(
        eq(table.id, 1),
        lt(table.computedAt, new Date(now - STATS_TTL_MS)),
        or(
          isNull(table.refreshStartedAt),
          lt(table.refreshStartedAt, new Date(now - REFRESH_LEASE_MS)),
        ),
      ),
    )
    .returning({ id: table.id });
  return claimed.length > 0;
}

function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Dates do not survive jsonb, so the three the payload carries come back as ISO
 * strings and are re-hydrated here, keeping the documented `Date | null` shape
 * for every caller.
 */
function reviveCoverageStats(
  stored: CoverageScan,
  computedAt: Date,
): CoverageStats {
  const c = stored as CoverageScan & {
    activity: {
      lastPlayerSnapshotAt: Date | string | null;
      lastClanRefreshAt: Date | string | null;
    };
    funFacts: { oldestPlayerSnapshotAt: Date | string | null };
  };
  return {
    ...c,
    computedAt,
    activity: {
      ...c.activity,
      lastPlayerSnapshotAt: toDate(c.activity.lastPlayerSnapshotAt),
      lastClanRefreshAt: toDate(c.activity.lastClanRefreshAt),
    },
    funFacts: {
      ...c.funFacts,
      oldestPlayerSnapshotAt: toDate(c.funFacts.oldestPlayerSnapshotAt),
    },
  };
}

/** What {@link readLiveReadings} takes at the instant of the request. */
type LiveReadings = {
  lastPlayerSnapshotAt: Date | null;
  lastClanRefreshAt: Date | null;
  clanRefreshQueue: number;
  playerRefreshQueue: number;
};

/**
 * The four figures that say what the tracker is doing RIGHT NOW, read at the
 * instant of the request rather than out of the row.
 *
 * Everything else on this page is a measurement, and an hour-old measurement is
 * honestly dated by `computedAt`. These four are not measurements of the region,
 * they are readings of a process that moves every few seconds, and a frozen one
 * does not read as old, it reads as a different answer.
 *
 * The two stamps are the worst of it, because the page renders them as
 * `now - value` against the reader's own clock: a frozen one drifts by exactly
 * the age of the row and reaches 59 minutes just before each refresh. Measured
 * on EU at 20 minutes of row age, both printed "20 minutes ago" while the
 * pipeline and the clan backfill had each written 6 seconds earlier. Two
 * continuous writers cannot agree to the minute, and that they did was the whole
 * tell. A stale count is old, a stale timestamp accuses a healthy pipeline of
 * having stopped.
 *
 * All four are affordable, which is the line drawn here: the stamps are an
 * index-only scan backward over one column (0.310 ms and 0.263 ms, 6 shared
 * buffer hits each) and the queues are counts of tables holding single digits
 * (1.5 ms and 0.8 ms). `snapshotBacklog` moves just as fast and is deliberately
 * NOT here: it is a filtered scan of the whole players table at 1,637 ms, one of
 * the aggregates this entire change exists to take off the request path. It
 * stays hourly and the page dates it.
 */
async function readLiveReadings(region: Region): Promise<LiveReadings> {
  const playersTable = playersByRegion[region];
  const clansTable = clansByRegion[region];
  const [player, clan, playerQueue, clanQueue] = await Promise.all([
    db.execute<{ at: string | null }>(
      sql`SELECT MAX(last_seen_at)::text AS at FROM ${playersTable}`,
    ),
    db.execute<{ at: string | null }>(
      sql`SELECT MAX(last_refreshed_at)::text AS at FROM ${clansTable}`,
    ),
    db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM ${playerRefreshQueueByRegion[region]}`,
    ),
    db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text AS count FROM ${clanRefreshQueueByRegion[region]}`,
    ),
  ]);
  return {
    lastPlayerSnapshotAt: toDate(player[0]?.at ?? null),
    lastClanRefreshAt: toDate(clan[0]?.at ?? null),
    playerRefreshQueue: Number(playerQueue[0]?.count ?? 0),
    clanRefreshQueue: Number(clanQueue[0]?.count ?? 0),
  };
}

/** Lay the live readings over a payload, whether it came from the row or from
 * a recompute. Both paths must agree, or the figures a reader sees would depend
 * on which of them served them. */
function withLiveReadings(stats: CoverageStats, live: LiveReadings): CoverageStats {
  return {
    ...stats,
    clanRefreshQueue: live.clanRefreshQueue,
    playerRefreshQueue: live.playerRefreshQueue,
    activity: {
      ...stats.activity,
      lastPlayerSnapshotAt: live.lastPlayerSnapshotAt,
      lastClanRefreshAt: live.lastClanRefreshAt,
    },
  };
}

/**
 * The region's coverage figures, read from the materialized row.
 *
 * Nothing on this path scans a table. A stale row is served as it stands and
 * replaced behind the reader, so the cost sits off the request path for
 * everybody rather than landing on whoever arrives at the wrong moment.
 *
 * That is what the hourly `unstable_cache` was meant to buy and could not: its
 * entry lived in the shared ISR Redis, which runs `allkeys-lru` at a 2 GiB
 * ceiling with a key cap, so it was evicted well inside its hour. Measured over
 * 55 days, the eight full-table aggregates behind it ran 1,578 times a day
 * against the 24 the window promised, for 19% of the whole database's time. A
 * row in Postgres cannot be evicted, so the window it promises is the window it
 * keeps.
 */
export async function getCoverageStats(region: Region): Promise<CoverageStats> {
  const table = coverageStatsByRegion[region];
  const [row] = await db.select().from(table).where(eq(table.id, 1)).limit(1);

  // Nothing materialized yet: a fresh database, or a region whose first run has
  // not landed. Whoever finds it empty pays for it once, and is the only reader
  // who ever can.
  if (!row) {
    const fresh = await recomputeCoverageStats(region);
    return withLiveReadings(fresh, await readLiveReadings(region));
  }

  if (Date.now() - row.computedAt.getTime() >= STATS_TTL_MS) {
    if (await claimCoverageRefresh(region)) {
      // Deliberately not awaited: this reader is served the row already in
      // hand. A failure leaves the lease to expire rather than clearing it, so
      // the retry is paced instead of immediate.
      void recomputeCoverageStats(region).catch((err: unknown) => {
        console.error(`[coverage-stats] ${region} refresh failed:`, err);
      });
    }
  }

  const stats = reviveCoverageStats(
    row.payload as CoverageScan,
    row.computedAt,
  );
  return withLiveReadings(stats, await readLiveReadings(region));
}
