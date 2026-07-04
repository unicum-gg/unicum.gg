import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import {
  clanMembersByRegion,
  playersByRegion,
  topClansByRegion,
} from "@/services/db/schema";
import { getClansBriefInfo } from "@/services/wargaming/wot/clans/listings";
import { type Region } from "@unicum.gg/wargaming/region";

export type TopClanResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  members_count: number;
  rated_members_count: number;
  avg_wnx: number;
};

const MIN_MEMBERS = 50;
const ENRICH_CANDIDATES = 30;

type RankedClan = {
  clan_id: number;
  rated_members_count: number;
  avg_wnx: number;
};

// Allowlist for the metric->column mapping used by the leaderboard SQL.
// Exported so the by-language variant can validate against the same set
// without drifting.
export const VALID_METRIC_COLUMNS: Record<string, string> = {
  wn7: "wn7",
  wn8: "wn8",
  wnx: "wnx",
};

export async function computeTopClansByMetric(
  region: Region,
  metric: string,
  limit: number,
): Promise<TopClanResult[]> {
  // Aggregate over clan_members (portal-derived membership, refreshed
  // per-clan on demand + by clan-backfill-cron) JOINed with players for
  // the cached metric column. Battle weight comes from clan_members
  // overall_battles (= portal `battles_count` at refresh time), matching
  // exactly what `computeMetrics` in components/clans/header uses — so the
  // leaderboard value lines up with the clan page header.
  //
  // Previously this scanned player_snapshots with DISTINCT ON to derive
  // memberships, which was heavier and let stale snapshots (24h) drift
  // the rank vs the portal-truth shown on the clan page.
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) throw new Error(`computeTopClansByMetric: unknown metric ${metric}`);
  const players = playersByRegion[region];
  const clanMembers = clanMembersByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);
  const rows = (await db.execute(sql`
    SELECT
      cm.clan_id,
      COUNT(${metricCol})::int AS rated_members_count,
      (
        SUM(${metricCol} * cm.overall_battles)
          FILTER (WHERE ${metricCol} IS NOT NULL AND cm.overall_battles > 0)
        / NULLIF(
            SUM(cm.overall_battles)
              FILTER (WHERE ${metricCol} IS NOT NULL AND cm.overall_battles > 0),
            0
          )
      )::float8 AS avg_value
    FROM ${clanMembers} cm
    INNER JOIN ${players} p ON p.account_id = cm.account_id
    GROUP BY cm.clan_id
    -- Filter on RATED members. A clan can declare 90+ members but only
    -- a handful actually play — those few alts with 1-3 battles at 100%
    -- WR can produce absurd battle-weighted averages (e.g. DRAKS, the
    -- Dragon Ball-themed troll clan with 4,719 avg WNX from 14 actives).
    -- Requiring 50+ rated members forces a real player base before rank.
    HAVING COUNT(${metricCol}) >= ${MIN_MEMBERS}
    ORDER BY avg_value DESC NULLS LAST
    LIMIT ${ENRICH_CANDIDATES}
  `)) as unknown as Array<{
    clan_id: string | number;
    rated_members_count: number;
    avg_value: number;
  }>;

  const candidates: RankedClan[] = rows.map((r) => ({
    clan_id: Number(r.clan_id),
    rated_members_count: r.rated_members_count,
    avg_wnx: Number(r.avg_value),
  }));
  if (candidates.length === 0) return [];

  const clansBrief = await getClansBriefInfo(
    region,
    candidates.map((c) => c.clan_id),
  );
  const briefById = new Map(clansBrief.map((c) => [c.clan_id, c]));

  const enriched: TopClanResult[] = [];
  for (const c of candidates) {
    const brief = briefById.get(c.clan_id);
    if (!brief) continue;
    if (brief.members.length <= MIN_MEMBERS) continue;
    enriched.push({
      clan_id: c.clan_id,
      tag: brief.tag,
      name: brief.name,
      color: brief.color,
      emblem: brief.emblem,
      members_count: brief.members.length,
      rated_members_count: c.rated_members_count,
      avg_wnx: c.avg_wnx,
    });
    if (enriched.length >= limit) break;
  }
  return enriched;
}

export type TopClansSnapshot = {
  results: TopClanResult[];
  computedAt: Date | null;
};

export async function getTopClansByMetric(
  region: Region,
  metric: string,
  limit: number,
): Promise<TopClansSnapshot> {
  const topClans = topClansByRegion[region];
  const rows = await db
    .select()
    .from(topClans)
    .where(eq(topClans.metric, metric))
    .orderBy(asc(topClans.rank))
    .limit(limit);

  return {
    results: rows.map((r) => ({
      clan_id: r.clanId,
      tag: r.tag,
      name: r.name,
      color: r.color,
      emblem: r.emblem,
      members_count: r.membersCount,
      rated_members_count: r.ratedMembersCount,
      avg_wnx: Number(r.avgValue),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopClansByMetricByRegions(
  regions: Region[],
  metric: string,
  limit: number,
): Promise<Record<Region, TopClansSnapshot>> {
  const perRegion = await Promise.all(
    regions.map(
      async (region) =>
        [region, await getTopClansByMetric(region, metric, limit)] as const,
    ),
  );
  const out = {} as Record<Region, TopClansSnapshot>;
  for (const [region, snap] of perRegion) out[region] = snap;
  return out;
}
