import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clanMembersByRegion,
  clanRecentEventsByRegion,
  clanRefreshQueueByRegion,
  clansByRegion,
  playerRefreshQueueByRegion,
  playersByRegion,
  type ExpenseLedger,
} from "@unicum.gg/shared";
import {
  ACTIVITY_BUCKET_ORDER,
  ActivityBucket,
  activityBucketSql,
  REFRESH_CADENCE_MS,
  refreshCutoffSql,
} from "@unicum.gg/shared/players/refresh-policy";
import type { Region } from "@unicum.gg/wargaming";
import { getDiscordServerCount } from "./discord-servers";
import { getExpenseLedger } from "./expenses";
import { getModUsage } from "./mod-usage";
import { DAYS_WINDOW, buildDaySeries, getSnapshotTrends, type DailyPoint } from "./trends";

export type TableSize = { name: string; bytes: number };

export type RefreshPolicyBucket = {
  bucket: ActivityBucket;
  cadenceMs: number;
  total: number;
  onTime: number;
  neverSnapped: number;
};

export type CoverageScan = {
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
    // Refresh-policy health on the fetched portion of the player base:
    // `onTime` = players we re-checked within their bucket's cadence (keyed on
    // last_seen_at, see the query for why not snapshot taken_at). Excludes
    // Unfetched players (nothing fetched yet) so the % stays a clean signal
    // about the adaptive cadence rather than the discovery backlog.
    snapshotFreshness: {
      onTime: number;
      fetched: number;
    };
    awaitingFirstSnapshot: number;
  };
  refreshPolicy: RefreshPolicyBucket[];
  funFacts: {
    oldestPlayerSnapshotAt: Date | null;
    /** Accounts that have run the mod on this region, and the battles they
     * sent. See `getModUsage`. */
    modUsers: number;
    modBattles: number;
    totalBattlesTracked: number;
    /** Servers our bot is in. Global, not per region. `null` when Discord could
     * not be asked, so the page shows nothing rather than a false zero. */
    discordServers: number | null;
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
    costs: ExpenseLedger;
  };
};

async function approxRowCount(tableName: string): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT reltuples::bigint AS n FROM pg_class WHERE oid = ${tableName}::regclass`,
  )) as unknown as Array<{ n: number | string | null }>;
  return Math.max(0, Number(rows[0]?.n ?? 0));
}

/**
 * Measure the region, in full.
 *
 * This is what costs ~15s and 19% of the database over 55 days, and the only
 * caller is the hourly recompute in `index.ts`. Nothing on a request path may
 * call it.
 */
export async function getCoverageStatsUncached(
  region: Region,
): Promise<CoverageScan> {
  const playersTable = playersByRegion[region];
  const clansTable = clansByRegion[region];
  const clanMembersTable = clanMembersByRegion[region];
  const clanRecentEventsTable = clanRecentEventsByRegion[region];
  const clanRefreshQueueTable = clanRefreshQueueByRegion[region];
  const playerRefreshQueueTable = playerRefreshQueueByRegion[region];

  // Oldest + newest snapshot, read from the `players` table (~2M rows, ~20ms)
  // instead of the `player_snapshots` table (10M+ rows, no `taken_at` index),
  // where MIN/MAX each seq-scanned the whole thing for 20-40s and — run on the
  // 60s coverage revalidation, x4 regions — hogged the DB connection pool,
  // starving every other request-path query. A snapshot row is written when a
  // refresh finds a change, so `MAX(last_seen_at)` (indexed) tracks the same
  // live "still collecting" heartbeat (advances every pipeline tick), and
  // `MIN(first_seen_at)` is when the oldest tracked player first entered — i.e.
  // when our data begins. Both stay fresh at 60s at a fraction of the cost.
  const snapshotBounds = db.execute<{ oldest: string | null; newest: string | null }>(
    sql`SELECT MIN(first_seen_at)::text AS oldest, MAX(last_seen_at)::text AS newest FROM ${playersTable}`,
  );

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
    snapshotTrends,
    clansRefreshedLast24h,
    oldestSnapshot,
    modUsage,
    totalBattles,
    playersDiscoveredRows,
    clansDiscoveredRows,
    refreshPolicyReport,
    databaseBytes,
    tableSizeRows,
    discordServers,
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
    snapshotBounds.then((r) =>
      r[0]?.newest ? new Date(r[0].newest) : null,
    ),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MAX(last_refreshed_at)::text AS at FROM ${clansTable}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    // Rolling 24h snapshot count + the two daily-growth histograms, on their own
    // 1h cache (they are the remaining player_snapshots seq-scans; see above).
    getSnapshotTrends(region),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM ${clansTable}
            WHERE last_refreshed_at > NOW() - INTERVAL '24 hours'`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    snapshotBounds.then((r) =>
      r[0]?.oldest ? new Date(r[0].oldest) : null,
    ),
    getModUsage(region),
    // `players.battles` is the latest snapshot's battle count, refreshed on every
    // snapshot-cron tick — so summing it is one scan of the (narrower) players
    // table instead of a DISTINCT ON over all 4.3M player_snapshots rows.
    db
      .execute<{ total: string | null }>(
        sql`SELECT SUM(battles)::text AS total FROM ${playersTable}`,
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
    db
      .execute<{
        bucket: ActivityBucket;
        total: string;
        on_time: string;
        never_snapped: string;
      }>(
        // Per-bucket breakdown: total players in each activity bucket and how
        // many we re-checked within their bucket's target cadence ("on-time").
        // Freshness is keyed on `last_seen_at` (when the pipeline last refreshed
        // the player), NOT on snapshot `taken_at`: a snapshot row is only
        // written when a player's stats change, so `taken_at` freezes the moment
        // a player stops playing and can never re-enter its cadence window no
        // matter how faithfully we re-check them. `last_seen_at` measures what
        // the refresh policy actually controls — did we revisit them in time —
        // so it credits an inactive player we correctly re-checked at their
        // 90-day cadence and doesn't penalise us for them not playing. We still
        // require a fetch to have happened (`due_at <> 'epoch'`) so a never-
        // fetched player never counts as on-time. `due_at` defaults to epoch on
        // discovery and every pipeline touch (success/null/error) sets it to a
        // real time, so `due_at = 'epoch'` is an exact "never fetched / no
        // snapshot row" signal (verified equal to the old MAX(taken_at) GROUP BY
        // player_id result) that avoids a full seq-scan of player_snapshots.
        // Aggregated client-side into both the headline freshness stat (Unfetched
        // excluded from denominator so the % reflects refresh-policy health, not
        // the discovery backlog) and the per-bucket breakdown panel.
        sql`SELECT
              ${activityBucketSql(playersTable.lastBattleAt, playersTable.softDeletedAt)} AS bucket,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (
                WHERE ${playersTable.dueAt} <> 'epoch'::timestamptz
                  AND ${playersTable.lastSeenAt} >= ${refreshCutoffSql(playersTable.lastBattleAt)}
              )::text AS on_time,
              COUNT(*) FILTER (WHERE ${playersTable.dueAt} = 'epoch'::timestamptz)::text AS never_snapped
            FROM ${playersTable}
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
    getDiscordServerCount().catch(() => null),
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
      playerSnapshotsLast24h: snapshotTrends.playerSnapshotsLast24h,
      clansRefreshedLast24h: clansRefreshedLast24h,
      snapshotFreshness: refreshPolicyReport.freshness,
      awaitingFirstSnapshot: refreshPolicyReport.awaitingFirstSnapshot,
    },
    refreshPolicy: refreshPolicyReport.breakdown,
    funFacts: {
      oldestPlayerSnapshotAt: oldestSnapshot,
      modUsers: modUsage.users,
      modBattles: modUsage.battles,
      totalBattlesTracked: totalBattles,
      discordServers,
    },
    trends: {
      playersDiscoveredDaily: buildDaySeries(playersDiscoveredRows, DAYS_WINDOW),
      clansDiscoveredDaily: buildDaySeries(clansDiscoveredRows, DAYS_WINDOW),
      playerSnapshotsDaily: snapshotTrends.playerSnapshotsDaily,
      firstSnapshotsDaily: snapshotTrends.firstSnapshotsDaily,
    },
    infrastructure: {
      databaseBytes,
      tables: tableSizeRows.map((r) => ({
        name: r.name,
        bytes: Number(r.bytes),
      })),
      costs: getExpenseLedger(),
    },
  };
}
