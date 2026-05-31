import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { players, playerSnapshots, topClans } from "@/services/db/schema";
import {
  getLatestTankSnapshotsByAccounts,
  tankSnapshotsToTankStats,
} from "@/services/snapshots";
import { getClansBriefInfo } from "@/services/wargaming/wot/clans";
import type { Region } from "@/services/wargaming/wot";
import {
  computeWNX,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

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

export async function computeTopClansByWnx(
  region: Region,
  limit: number,
): Promise<TopClanResult[]> {
  const latest = await getLatestClanMembershipsByRegion(region);
  if (latest.length === 0) return [];

  const byClan = new Map<number, number[]>();
  for (const row of latest) {
    if (row.clanId === null) continue;
    const list = byClan.get(row.clanId);
    if (list) list.push(row.accountId);
    else byClan.set(row.clanId, [row.accountId]);
  }

  const eligibleClanIds: number[] = [];
  const accountsByClan = new Map<number, number[]>();
  for (const [clanId, accountIds] of byClan) {
    if (accountIds.length > MIN_MEMBERS) {
      eligibleClanIds.push(clanId);
      accountsByClan.set(clanId, accountIds);
    }
  }
  if (eligibleClanIds.length === 0) return [];

  const allAccountIds = eligibleClanIds.flatMap(
    (id) => accountsByClan.get(id) ?? [],
  );
  const [tankSnaps, wnxExpected] = await Promise.all([
    getLatestTankSnapshotsByAccounts(region, allAccountIds),
    getWNXExpectedValues(),
  ]);

  type Ranked = {
    clan_id: number;
    members_in_db: number;
    rated_members_count: number;
    avg_wnx: number;
  };
  const ranked: Ranked[] = [];
  for (const clanId of eligibleClanIds) {
    const accountIds = accountsByClan.get(clanId) ?? [];
    const wnxs: number[] = [];
    for (const accountId of accountIds) {
      const tanks = tankSnaps.get(accountId);
      if (!tanks || tanks.length === 0) continue;
      const wnx = computeWNX(tankSnapshotsToTankStats(tanks), wnxExpected);
      if (wnx !== null && Number.isFinite(wnx)) wnxs.push(wnx);
    }
    if (wnxs.length === 0) continue;
    const avg = wnxs.reduce((a, b) => a + b, 0) / wnxs.length;
    ranked.push({
      clan_id: clanId,
      members_in_db: accountIds.length,
      rated_members_count: wnxs.length,
      avg_wnx: avg,
    });
  }

  ranked.sort((a, b) => b.avg_wnx - a.avg_wnx);
  const candidates = ranked.slice(0, ENRICH_CANDIDATES);
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

type LatestMembership = {
  accountId: number;
  clanId: number | null;
};

async function getLatestClanMembershipsByRegion(
  region: Region,
): Promise<LatestMembership[]> {
  const ranked = db
    .select({
      accountId: players.accountId,
      clanId: playerSnapshots.clanId,
      rn: sql<number>`row_number() over (partition by ${playerSnapshots.playerId} order by ${playerSnapshots.takenAt} desc, ${playerSnapshots.id} desc)`.as(
        "rn",
      ),
    })
    .from(playerSnapshots)
    .innerJoin(players, eq(players.id, playerSnapshots.playerId))
    .where(
      and(eq(players.region, region), isNotNull(playerSnapshots.clanId)),
    )
    .as("ranked");

  return db
    .select({ accountId: ranked.accountId, clanId: ranked.clanId })
    .from(ranked)
    .where(eq(ranked.rn, 1));
}

export type TopClansSnapshot = {
  results: TopClanResult[];
  computedAt: Date | null;
};

export async function getTopClansByWnx(
  region: Region,
  limit: number,
): Promise<TopClansSnapshot> {
  const rows = await db
    .select()
    .from(topClans)
    .where(eq(topClans.region, region))
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
