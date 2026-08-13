import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import APP from "@/constants/app";
import { db } from "@unicum.gg/core/db";
import { countBotGuilds } from "@unicum.gg/core/discord";
import {
  clanMembersByRegion,
  clanRecentEventsByRegion,
  clanRefreshQueueByRegion,
  clansByRegion,
  env,
  playerRefreshQueueByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import {
  ACTIVITY_BUCKET_ORDER,
  ActivityBucket,
  activityBucketSql,
  REFRESH_CADENCE_MS,
  refreshCutoffSql,
} from "@unicum.gg/shared/players/refresh-policy";
import type { Region } from "@unicum.gg/wargaming";

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
    biggestClan: {
      tag: string;
      name: string;
      membersCount: number;
    } | null;
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
    costs: {
      breakdown: { label: string; usdAnnual: number; note?: string }[];
      totalAnnualUsd: number;
    };
  };
};

// OVH VPS-4, monthly no-commit billing. €23.49 HT + 20% VAT = €28.19 TTC/mo
// ≈ $30.45/mo at ~1.08 USD/EUR.
const HOSTING_USD_MONTHLY = 30.45;
const DOMAIN_USD_ANNUAL = 51.6;

// OVH additional IPv4, €2.39 TTC/mo ≈ $2.58. Each extra egress IP buys its own
// G-Core per-IP rate budget so we can spread Wargaming traffic across them.
const EGRESS_IP_USD_MONTHLY = 2.58;
// Additional egress IPs = the distinct Wargaming egress targets we route through
// minus the one primary IP included with the VPS. Derived from env so the cost
// tracks reality automatically as we add or drop IPs (WG_EGRESS_* holds one
// entry per egress path; see packages/core wargaming/client).
const ADDITIONAL_EGRESS_IPS = Math.max(
  0,
  new Set(
    [env.WG_EGRESS_EU, env.WG_EGRESS_NA, env.WG_EGRESS_ASIA]
      .flatMap((v) => v?.split(",") ?? [])
      .map((s) => s.trim())
      .filter(Boolean),
  ).size - 1,
);
const EGRESS_IPS_USD_ANNUAL = ADDITIONAL_EGRESS_IPS * EGRESS_IP_USD_MONTHLY * 12;
const TOTAL_ANNUAL_USD =
  HOSTING_USD_MONTHLY * 12 + DOMAIN_USD_ANNUAL + EGRESS_IPS_USD_ANNUAL;

/**
 * Current monthly infrastructure cost (USD). A pure constant-derived figure (no
 * DB), so the funding endpoint and the top-bar mini bar can use it cheaply on
 * every request without touching the heavy coverage query.
 */
export function getMonthlyInfraCostUsd(): number {
  return TOTAL_ANNUAL_USD / 12;
}

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

// Its own window, deliberately far longer than the payload's 60s: the guild
// list moves on the order of weeks, so sharing that window would mean an
// outbound Discord call every minute, per region, for a number that almost
// never changes.
//
// Throwing rather than returning the null is what keeps a bad minute from
// lasting an hour: a value is cached, a rejection is not, so a Discord that did
// not answer is retried on the next request instead of being frozen for the
// whole window. Observed for real, the first cold render timed out against our
// own busy server and the page then said "n/a" long after Discord was fine.
const getDiscordServerCount = unstable_cache(
  async () => {
    const count = await countBotGuilds();
    if (count === null) throw new Error("discord_unavailable");
    return count;
  },
  ["coverage-discord-servers"],
  { revalidate: 3600, tags: ["coverage"] },
);

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

  // Oldest + newest snapshot in a single scan. player_snapshots has no index on
  // `taken_at`, so MIN and MAX each seq-scan the whole table; sharing one query
  // (awaited twice below) pays for a single scan instead of two.
  const snapshotBounds = db.execute<{ oldest: string | null; newest: string | null }>(
    sql`SELECT MIN(taken_at)::text AS oldest, MAX(taken_at)::text AS newest FROM ${playerSnapshotsTable}`,
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
    snapshotBounds.then((r) =>
      r[0]?.oldest ? new Date(r[0].oldest) : null,
    ),
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
      discordServers,
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
            note: "OVH VPS-4, 8 vCPU / 24 GB RAM / 200 GB NVMe",
          },
          {
            label: "Domain",
            usdAnnual: DOMAIN_USD_ANNUAL,
            note: `${APP.NAME}, billed yearly`,
          },
          ...(ADDITIONAL_EGRESS_IPS > 0
            ? [
                {
                  label: "Egress IPs",
                  usdAnnual: EGRESS_IPS_USD_ANNUAL,
                  note: `${ADDITIONAL_EGRESS_IPS} additional OVH IPv4 for multi-IP Wargaming throughput`,
                },
              ]
            : []),
          {
            label: "CDN, SSL, deploys",
            usdAnnual: 0,
            note: "Cloudflare free tier + Let's Encrypt + self-hosted Coolify",
          },
        ],
        totalAnnualUsd: TOTAL_ANNUAL_USD,
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
  // 60s: the live-monitoring figures (last-24h counts, last-snapshot time,
  // backlog) must stay fresh, so we keep the short window. It's affordable now
  // that the per-player 100s+ scans are gone — the remaining player_snapshots
  // scans are single-digit seconds and only run on a background revalidation.
  { revalidate: 60, tags: ["coverage"] },
);

function toDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

/**
 * Cached coverage stats: 60s fresh, then revalidate in background. The heavy
 * per-player aggregates (two ~100s scans) were replaced with cached `players`
 * columns and a shared MIN/MAX scan, so the 60s window is cheap to sustain and
 * the live-monitoring figures stay fresh.
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
