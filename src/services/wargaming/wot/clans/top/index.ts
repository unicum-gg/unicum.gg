import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import {
  playerSnapshotsByRegion,
  playersByRegion,
  topClansByRegion,
} from "@/services/db/schema";
import { getClansBriefInfo } from "@/services/wargaming/wot/clans/listings";
import { type Region } from "@/services/wargaming/wot";

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
  members_in_db: number;
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
  // Single SQL aggregation: for each player take the latest snapshot's
  // clan_id + battles (DISTINCT ON), join the chosen metric column on
  // the players row (cached by snapshot-cron), then GROUP BY clan.
  // Average is battle-weighted so a freshly-recruited noob with 1 battle
  // and freak rating doesn't drag the clan rank; matches the in-app
  // computeMetrics in components/clans/header.
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) throw new Error(`computeTopClansByMetric: unknown metric ${metric}`);
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);
  const rows = (await db.execute(sql`
    WITH latest_memberships AS (
      SELECT DISTINCT ON (ps.player_id)
        ps.player_id,
        ps.clan_id,
        ps.battles
      FROM ${playerSnapshots} ps
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    )
    SELECT
      lm.clan_id,
      COUNT(*)::int AS members_in_db,
      COUNT(${metricCol})::int AS rated_members_count,
      (
        SUM(${metricCol} * lm.battles)
          FILTER (WHERE ${metricCol} IS NOT NULL AND lm.battles > 0)
        / NULLIF(
            SUM(lm.battles)
              FILTER (WHERE ${metricCol} IS NOT NULL AND lm.battles > 0),
            0
          )
      )::float8 AS avg_value
    FROM latest_memberships lm
    INNER JOIN ${players} p ON p.id = lm.player_id
    GROUP BY lm.clan_id
    HAVING COUNT(*) > ${MIN_MEMBERS} AND COUNT(${metricCol}) > 0
    ORDER BY avg_value DESC NULLS LAST
    LIMIT ${ENRICH_CANDIDATES}
  `)) as unknown as Array<{
    clan_id: string | number;
    members_in_db: number;
    rated_members_count: number;
    avg_value: number;
  }>;

  const candidates: RankedClan[] = rows.map((r) => ({
    clan_id: Number(r.clan_id),
    members_in_db: r.members_in_db,
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
