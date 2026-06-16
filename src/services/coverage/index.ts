import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import APP from "@/constants/app";
import { db } from "@/services/db";
import {
  clanMembersByRegion,
  clanRecentEventsByRegion,
  clanRefreshQueueByRegion,
  clansByRegion,
  playerRefreshQueueByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@/services/db/schema";
import {
  ACTIVITY_BUCKET_ORDER,
  ActivityBucket,
  activityBucketSql,
  REFRESH_CADENCE_MS,
  refreshCutoffSql,
} from "@/services/players/refresh-policy";
import type { Region } from "@/services/wargaming/wot";

export type DailyPoint = { day: string; count: number };

export type TableSize = { name: string; bytes: number };

export type RefreshPolicyBucket = {
  bucket: ActivityBucket;
  cadenceMs: number;
  total: number;
  onTime: number;
  neverSnapped: number;
};

export type CoverageStats = {
  region: Region;
  players: number;
  clans: number;
  playerSnapshots: number;
  tankSnapshots: number;
  clanMembers: number;
  clanRecentEvents: number;
  clanRefreshQueue: number;
  playerRefreshQueue: number;
  snapshotBacklog: number;
  activity: {
    lastPlayerSnapshotAt: Date | null;
    lastClanRefreshAt: Date | null;
    playerSnapshotsLast24h: number;
    clansRefreshedLast24h: number;
    // Refresh-policy health on the fetched portion of the player base.
    // Excludes Unfetched players (they have nothing to snapshot yet) so
    // the % stays a clean signal about the adaptive cadence rather than
    // being dragged down by the discovery backlog.
    snapshotFreshness: {
      onTime: number;
      fetched: number;
    };
    awaitingFirstSnapshot: number;
  };
  refreshPolicy: RefreshPolicyBucket[];
  funFacts: {
    oldestPlayerSnapshotAt: Date | null;
    biggestClan: {
      tag: string;
      name: string;
      membersCount: number;
    } | null;
    totalBattlesTracked: number;
  };
  trends: {
    playersDiscoveredDaily: DailyPoint[];
    clansDiscoveredDaily: DailyPoint[];
    playerSnapshotsDaily: DailyPoint[];
    firstSnapshotsDaily: DailyPoint[];
  };
  infrastructure: {
    databaseBytes: number;
    tables: TableSize[];
    costs: {
      breakdown: { label: string; usdAnnual: number; note?: string }[];
      totalAnnualUsd: number;
    };
  };
};

// OVH VPS-2, monthly no-commit billing. €9.99 HT + 20% VAT = €11.99 TTC/mo
// ≈ $12.99/mo at ~1.08 USD/EUR.
const HOSTING_USD_MONTHLY = 12.99;
const DOMAIN_USD_ANNUAL = 51.6;

const DAYS_WINDOW = 30;

function buildDaySeries(
  rows: { day: string; count: string }[],
  days: number,
): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const key = r.day.slice(0, 10);
    byDay.set(key, Number(r.count));
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

async function approxRowCount(tableName: string): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT reltuples::bigint AS n FROM pg_class WHERE oid = ${tableName}::regclass`,
  )) as unknown as Array<{ n: number | string | null }>;
  return Math.max(0, Number(rows[0]?.n ?? 0));
}

async function getCoverageStatsUncached(
  region: Region,
): Promise<CoverageStats> {
  const playersTable = playersByRegion[region];
  const playerSnapshotsTable = playerSnapshotsByRegion[region];
  const clansTable = clansByRegion[region];
  const clanMembersTable = clanMembersByRegion[region];
  const clanRecentEventsTable = clanRecentEventsByRegion[region];
  const clanRefreshQueueTable = clanRefreshQueueByRegion[region];
  const playerRefreshQueueTable = playerRefreshQueueByRegion[region];

  const [
    players,
    clans,
    playerSnapshots,
    tankSnapshots,
    clanMembers,
    clanRecentEvents,
    clanRefreshQueue,
    playerRefreshQueue,
    snapshotBacklog,
    lastPlayerSnapshot,
    lastClanRefresh,
    snapshotsLast24h,
    clansRefreshedLast24h,
    oldestSnapshot,
    biggestClan,
    totalBattles,
    playersDiscoveredRows,
    clansDiscoveredRows,
    snapshotsDailyRows,
    firstSnapshotsDailyRows,
    refreshPolicyReport,
    databaseBytes,
    tableSizeRows,
  ] = await Promise.all([
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${playersTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${clansTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    // Exact COUNT(*) on player_snapshots + tank_snapshots is too costly
    // (EU tank_snapshots is ~150M rows, saturates IO for >10s and starves
    // request-path queries). `pg_class.reltuples` is the planner's estimate,
    // refreshed by autovacuum/analyze, accurate within a few %.
    approxRowCount(`${region}_player_snapshots`),
    approxRowCount(`${region}_tank_snapshots`),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${clanMembersTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${clanRecentEventsTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${clanRefreshQueueTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${playerRefreshQueueTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        // Overdue per the adaptive refresh policy (see refresh-policy.ts):
        // a player is "overdue" when last_seen_at is older than the cadence
        // for their `last_battle_at` bucket AND they aren't currently inside
        // the 30-day soft-delete recheck window. Mirrors the snapshot cron's
        // WHERE filter exactly so the number on /coverage matches the queue
        // the cron actually drains.
        sql`SELECT COUNT(*)::text AS count
            FROM ${playersTable}
            WHERE ${playersTable.lastSeenAt} < ${refreshCutoffSql(playersTable.lastBattleAt)}
              AND (${playersTable.softDeletedAt} IS NULL
                   OR ${playersTable.softDeletedAt} < NOW() - INTERVAL '30 days')`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MAX(taken_at)::text AS at FROM ${playerSnapshotsTable}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MAX(last_refreshed_at)::text AS at FROM ${clansTable}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM ${playerSnapshotsTable}
            WHERE taken_at > NOW() - INTERVAL '24 hours'`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM ${clansTable}
            WHERE last_refreshed_at > NOW() - INTERVAL '24 hours'`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MIN(taken_at)::text AS at FROM ${playerSnapshotsTable}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ tag: string; name: string; members_count: number }>(
        sql`SELECT tag, name, members_count
            FROM ${clansTable}
            ORDER BY members_count DESC
            LIMIT 1`,
      )
      .then((r) => {
        const row = r[0];
        if (!row) return null;
        return {
          tag: row.tag,
          name: row.name,
          membersCount: Number(row.members_count),
        };
      }),
    db
      .execute<{ total: string | null }>(
        sql`SELECT SUM(latest.battles)::text AS total
            FROM (
              SELECT DISTINCT ON (player_id) battles
              FROM ${playerSnapshotsTable}
              ORDER BY player_id, taken_at DESC
            ) latest`,
      )
      .then((r) => Number(r[0]?.total ?? 0)),
    db.execute<{ day: string; count: string }>(
      sql`SELECT date_trunc('day', first_seen_at)::text AS day, COUNT(*)::text AS count
          FROM ${playersTable}
          WHERE first_seen_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
    db.execute<{ day: string; count: string }>(
      sql`SELECT date_trunc('day', first_seen_at)::text AS day, COUNT(*)::text AS count
          FROM ${clansTable}
          WHERE first_seen_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
    db.execute<{ day: string; count: string }>(
      sql`SELECT date_trunc('day', taken_at)::text AS day, COUNT(*)::text AS count
          FROM ${playerSnapshotsTable}
          WHERE taken_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
    db.execute<{ day: string; count: string }>(
      // First-time snapshots per day: bucket each player by their oldest
      // taken_at, then count per day. Reads pair with playersDiscoveredDaily
      // to show the discovery -> first-snapshot pipeline (are we keeping up
      // with new account onboarding or piling up?).
      sql`WITH firsts AS (
            SELECT player_id, MIN(taken_at) AS first_at
            FROM ${playerSnapshotsTable}
            GROUP BY player_id
          )
          SELECT date_trunc('day', first_at)::text AS day, COUNT(*)::text AS count
          FROM firsts
          WHERE first_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
    db
      .execute<{
        bucket: ActivityBucket;
        total: string;
        on_time: string;
        never_snapped: string;
      }>(
        // Per-bucket breakdown: total players in each activity bucket and
        // how many have a recent enough snapshot to count as "on-time"
        // against their bucket's target cadence. Aggregated client-side
        // into both the headline freshness stat (Unfetched excluded from
        // denominator so the % reflects refresh-policy health, not the
        // discovery backlog) and the per-bucket breakdown panel.
        sql`WITH last_snap AS (
              SELECT player_id, MAX(taken_at) AS taken_at
              FROM ${playerSnapshotsTable}
              GROUP BY player_id
            )
            SELECT
              ${activityBucketSql(playersTable.lastBattleAt, playersTable.softDeletedAt)} AS bucket,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (
                WHERE ls.taken_at IS NOT NULL
                  AND ls.taken_at >= ${refreshCutoffSql(playersTable.lastBattleAt)}
              )::text AS on_time,
              COUNT(*) FILTER (WHERE ls.taken_at IS NULL)::text AS never_snapped
            FROM ${playersTable}
            LEFT JOIN last_snap ls ON ls.player_id = ${playersTable.id}
            GROUP BY bucket`,
      )
      .then((rows) => {
        const byBucket = new Map(rows.map((r) => [r.bucket, r]));
        const breakdown: RefreshPolicyBucket[] = ACTIVITY_BUCKET_ORDER.map(
          (bucket) => {
            const r = byBucket.get(bucket);
            return {
              bucket,
              cadenceMs: REFRESH_CADENCE_MS[bucket],
              total: r ? Number(r.total) : 0,
              onTime: r ? Number(r.on_time) : 0,
              neverSnapped: r ? Number(r.never_snapped) : 0,
            };
          },
        );
        const refreshable = (b: RefreshPolicyBucket) =>
          b.bucket !== ActivityBucket.Unfetched &&
          b.bucket !== ActivityBucket.Hidden;
        const fetched = breakdown
          .filter(refreshable)
          .reduce((sum, b) => sum + b.total, 0);
        const onTime = breakdown
          .filter(refreshable)
          .reduce((sum, b) => sum + b.onTime, 0);
        const awaitingFirstSnapshot =
          breakdown.find((b) => b.bucket === ActivityBucket.Unfetched)?.total ??
          0;
        return {
          breakdown,
          freshness: { onTime, fetched },
          awaitingFirstSnapshot,
        };
      }),
    db
      .execute<{ bytes: string }>(
        sql`SELECT pg_database_size(current_database())::text AS bytes`,
      )
      .then((r) => Number(r[0]?.bytes ?? 0)),
    db.execute<{ name: string; bytes: string }>(
      sql`SELECT c.relname AS name, pg_total_relation_size(c.oid)::text AS bytes
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY pg_total_relation_size(c.oid) DESC
          LIMIT 10`,
    ),
  ]);

  return {
    region,
    players,
    clans,
    playerSnapshots,
    tankSnapshots,
    clanMembers,
    clanRecentEvents,
    clanRefreshQueue,
    playerRefreshQueue,
    snapshotBacklog,
    activity: {
      lastPlayerSnapshotAt: lastPlayerSnapshot,
      lastClanRefreshAt: lastClanRefresh,
      playerSnapshotsLast24h: snapshotsLast24h,
      clansRefreshedLast24h: clansRefreshedLast24h,
      snapshotFreshness: refreshPolicyReport.freshness,
      awaitingFirstSnapshot: refreshPolicyReport.awaitingFirstSnapshot,
    },
    refreshPolicy: refreshPolicyReport.breakdown,
    funFacts: {
      oldestPlayerSnapshotAt: oldestSnapshot,
      biggestClan,
      totalBattlesTracked: totalBattles,
    },
    trends: {
      playersDiscoveredDaily: buildDaySeries(playersDiscoveredRows, DAYS_WINDOW),
      clansDiscoveredDaily: buildDaySeries(clansDiscoveredRows, DAYS_WINDOW),
      playerSnapshotsDaily: buildDaySeries(snapshotsDailyRows, DAYS_WINDOW),
      firstSnapshotsDaily: buildDaySeries(firstSnapshotsDailyRows, DAYS_WINDOW),
    },
    infrastructure: {
      databaseBytes,
      tables: tableSizeRows.map((r) => ({
        name: r.name,
        bytes: Number(r.bytes),
      })),
      costs: {
        breakdown: [
          {
            label: "VPS hosting",
            usdAnnual: HOSTING_USD_MONTHLY * 12,
            note: "OVH VPS-2, 6 vCPU / 12 GB RAM / 100 GB NVMe",
          },
          {
            label: "Domain",
            usdAnnual: DOMAIN_USD_ANNUAL,
            note: `${APP.NAME}, billed yearly`,
          },
          {
            label: "CDN, SSL, deploys",
            usdAnnual: 0,
            note: "Cloudflare free tier + Let's Encrypt + self-hosted Coolify",
          },
        ],
        totalAnnualUsd: HOSTING_USD_MONTHLY * 12 + DOMAIN_USD_ANNUAL,
      },
    },
  };
}

// `unstable_cache` round-trips values through JSON, so Date fields come back
// as ISO strings on a cache hit. The thin wrapper below re-hydrates them so
// callers keep the documented `Date | null` shape.
const getCoverageStatsCached = unstable_cache(
  getCoverageStatsUncached,
  ["coverage-stats"],
  { revalidate: 60, tags: ["coverage"] },
);

function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Cached coverage stats: 60s fresh, then revalidate in background. Without
 * this cache the page would hit ~18 DB queries (incl. a multi-second
 * aggregate) on every request.
 */
export async function getCoverageStats(region: Region): Promise<CoverageStats> {
  const c = (await getCoverageStatsCached(region)) as CoverageStats & {
    activity: {
      lastPlayerSnapshotAt: Date | string | null;
      lastClanRefreshAt: Date | string | null;
    };
    funFacts: { oldestPlayerSnapshotAt: Date | string | null };
  };
  return {
    ...c,
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
