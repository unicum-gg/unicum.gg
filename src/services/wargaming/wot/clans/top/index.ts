import { asc, sql } from "drizzle-orm";
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

export async function computeTopClansByWnx(
  region: Region,
  limit: number,
): Promise<TopClanResult[]> {
  // Single SQL aggregation: for each player take the latest snapshot's clan_id
  // (DISTINCT ON), join `players.wnx` (cached by snapshot-cron), then GROUP BY
  // clan to count members and average the WNX. Replaces an in-process compute
  // that fetched tank snapshots for every member of every eligible clan and
  // blew through PG's 65k-param limit on regions with thousands of clans.
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const rows = (await db.execute(sql`
    WITH latest_memberships AS (
      SELECT DISTINCT ON (ps.player_id)
        ps.player_id,
        ps.clan_id
      FROM ${playerSnapshots} ps
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    )
    SELECT
      lm.clan_id,
      COUNT(*)::int AS members_in_db,
      COUNT(p.wnx)::int AS rated_members_count,
      AVG(p.wnx)::float8 AS avg_wnx
    FROM latest_memberships lm
    INNER JOIN ${players} p ON p.id = lm.player_id
    GROUP BY lm.clan_id
    HAVING COUNT(*) > ${MIN_MEMBERS} AND COUNT(p.wnx) > 0
    ORDER BY avg_wnx DESC
    LIMIT ${ENRICH_CANDIDATES}
  `)) as unknown as Array<{
    clan_id: string | number;
    members_in_db: number;
    rated_members_count: number;
    avg_wnx: number;
  }>;

  const candidates: RankedClan[] = rows.map((r) => ({
    clan_id: Number(r.clan_id),
    members_in_db: r.members_in_db,
    rated_members_count: r.rated_members_count,
    avg_wnx: Number(r.avg_wnx),
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

export async function getTopClansByWnx(
  region: Region,
  limit: number,
): Promise<TopClansSnapshot> {
  const topClans = topClansByRegion[region];
  const rows = await db
    .select()
    .from(topClans)
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
      avg_wnx: Number(r.avgWnx),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopClansByWnxByRegions(
  regions: Region[],
  limit: number,
): Promise<Record<Region, TopClansSnapshot>> {
  const perRegion = await Promise.all(
    regions.map(async (region) => [region, await getTopClansByWnx(region, limit)] as const),
  );
  const out = {} as Record<Region, TopClansSnapshot>;
  for (const [region, snap] of perRegion) out[region] = snap;
  return out;
}
