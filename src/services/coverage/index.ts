import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/services/db";
import {
  clanMembersByRegion,
  clanRecentEventsByRegion,
  clanRefreshQueueByRegion,
  clansByRegion,
  playerRefreshQueueByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
} from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";

export type DailyPoint = { day: string; count: number };

export type TableSize = { name: string; bytes: number };

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
  activity: {
    lastPlayerSnapshotAt: Date | null;
    lastClanRefreshAt: Date | null;
    playerSnapshotsLast24h: number;
    clansRefreshedLast24h: number;
  };
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
    playerSnapshotsDaily: DailyPoint[];
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

// Contabo Cloud VPS 10, monthly no-commit billing. €8.49/mo ≈ $9.50/mo at 1.12 USD/EUR.
const HOSTING_USD_MONTHLY = 9.5;
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

async function getCoverageStatsUncached(
  region: Region,
): Promise<CoverageStats> {
  const playersTable = playersByRegion[region];
  const playerSnapshotsTable = playerSnapshotsByRegion[region];
  const tankSnapshotsTable = tankSnapshotsByRegion[region];
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
    lastPlayerSnapshot,
    lastClanRefresh,
    snapshotsLast24h,
    clansRefreshedLast24h,
    oldestSnapshot,
    biggestClan,
    totalBattles,
    playersDiscoveredRows,
    snapshotsDailyRows,
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
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${playerSnapshotsTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM ${tankSnapshotsTable}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
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
      sql`SELECT date_trunc('day', taken_at)::text AS day, COUNT(*)::text AS count
          FROM ${playerSnapshotsTable}
          WHERE taken_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
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
    activity: {
      lastPlayerSnapshotAt: lastPlayerSnapshot,
      lastClanRefreshAt: lastClanRefresh,
      playerSnapshotsLast24h: snapshotsLast24h,
      clansRefreshedLast24h: clansRefreshedLast24h,
    },
    funFacts: {
      oldestPlayerSnapshotAt: oldestSnapshot,
      biggestClan,
      totalBattlesTracked: totalBattles,
    },
    trends: {
      playersDiscoveredDaily: buildDaySeries(playersDiscoveredRows, DAYS_WINDOW),
      playerSnapshotsDaily: buildDaySeries(snapshotsDailyRows, DAYS_WINDOW),
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
            note: "Contabo Cloud VPS 10, 6 vCPU / 12 GB RAM",
          },
          {
            label: "Domain",
            usdAnnual: DOMAIN_USD_ANNUAL,
            note: "unicum.gg, billed yearly",
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
