import { sql } from "drizzle-orm";
import { db } from "@/services/db";
import type { Region } from "@/services/wargaming/wot";

export type DailyPoint = { day: string; count: number };

export type CoverageStats = {
  region: Region;
  players: number;
  clans: number;
  playerSnapshots: number;
  tankSnapshots: number;
  clanMembers: number;
  clanRecentEvents: number;
  discoveryQueue: number;
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
};

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

export async function getCoverageStats(region: Region): Promise<CoverageStats> {
  const [
    players,
    clans,
    playerSnapshots,
    tankSnapshots,
    clanMembers,
    clanRecentEvents,
    discoveryQueue,
    lastPlayerSnapshot,
    lastClanRefresh,
    snapshotsLast24h,
    clansRefreshedLast24h,
    oldestSnapshot,
    biggestClan,
    totalBattles,
    playersDiscoveredRows,
    snapshotsDailyRows,
  ] = await Promise.all([
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM players WHERE region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM clans WHERE region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM player_snapshots ps
            JOIN players p ON p.id = ps.player_id
            WHERE p.region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM tank_snapshots ts
            JOIN players p ON p.id = ts.player_id
            WHERE p.region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM clan_members WHERE region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM clan_recent_events WHERE region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM clan_discovery_queue WHERE region = ${region}`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MAX(ps.taken_at)::text AS at
            FROM player_snapshots ps
            JOIN players p ON p.id = ps.player_id
            WHERE p.region = ${region}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MAX(last_refreshed_at)::text AS at FROM clans WHERE region = ${region}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM player_snapshots ps
            JOIN players p ON p.id = ps.player_id
            WHERE p.region = ${region} AND ps.taken_at > NOW() - INTERVAL '24 hours'`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count
            FROM clans
            WHERE region = ${region} AND last_refreshed_at > NOW() - INTERVAL '24 hours'`,
      )
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .execute<{ at: string | null }>(
        sql`SELECT MIN(ps.taken_at)::text AS at
            FROM player_snapshots ps
            JOIN players p ON p.id = ps.player_id
            WHERE p.region = ${region}`,
      )
      .then((r) => (r[0]?.at ? new Date(r[0].at) : null)),
    db
      .execute<{ tag: string; name: string; members_count: number }>(
        sql`SELECT tag, name, members_count
            FROM clans
            WHERE region = ${region}
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
              SELECT DISTINCT ON (ps.player_id) ps.battles
              FROM player_snapshots ps
              JOIN players p ON p.id = ps.player_id
              WHERE p.region = ${region}
              ORDER BY ps.player_id, ps.taken_at DESC
            ) latest`,
      )
      .then((r) => Number(r[0]?.total ?? 0)),
    db.execute<{ day: string; count: string }>(
      sql`SELECT date_trunc('day', first_seen_at)::text AS day, COUNT(*)::text AS count
          FROM players
          WHERE region = ${region}
            AND first_seen_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
    ),
    db.execute<{ day: string; count: string }>(
      sql`SELECT date_trunc('day', ps.taken_at)::text AS day, COUNT(*)::text AS count
          FROM player_snapshots ps
          JOIN players p ON p.id = ps.player_id
          WHERE p.region = ${region}
            AND ps.taken_at > NOW() - (${DAYS_WINDOW} || ' days')::interval
          GROUP BY day
          ORDER BY day`,
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
    discoveryQueue,
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
  };
}
