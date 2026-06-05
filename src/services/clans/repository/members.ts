import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type ClanMember,
  clanMembersByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@/services/db/schema";
import { discoverPlayersBackground } from "@/services/discovery/players";
import { clanChannel, publish } from "@/services/live/pubsub";
import type { Region } from "@/services/wargaming/wot";
import {
  type ClanMemberPeriodStats,
  type ClanMemberStats,
  getClanMembersStats,
} from "@/services/wargaming/wot/clans/members";
import { dedup, STALE_AFTER_MS } from "./internal";

type PlayerRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  wnxRecent: number | null;
};

function memberStatsFromRow(
  row: ClanMember,
  ratings: PlayerRatings | null,
): ClanMemberStats {
  return {
    accountId: Number(row.accountId),
    name: row.name,
    role: row.role,
    roleLocalized: row.roleLocalized,
    roleRank: row.roleRank,
    daysInClan: row.daysInClan,
    lastBattleTime: row.lastBattleTime,
    personalRating: row.personalRating,
    overall:
      row.overallBattles !== null &&
      row.overallWinsPct !== null &&
      row.overallDamagePerBattle !== null &&
      row.overallExpPerBattle !== null &&
      row.overallFragsPerBattle !== null &&
      row.overallBattlesPerDay !== null
        ? {
            battles: row.overallBattles,
            winsPercentage: row.overallWinsPct,
            damagePerBattle: row.overallDamagePerBattle,
            expPerBattle: row.overallExpPerBattle,
            fragsPerBattle: row.overallFragsPerBattle,
            battlesPerDay: row.overallBattlesPerDay,
          }
        : null,
    d28:
      row.d28Battles !== null &&
      row.d28WinsPct !== null &&
      row.d28DamagePerBattle !== null &&
      row.d28ExpPerBattle !== null &&
      row.d28FragsPerBattle !== null &&
      row.d28BattlesPerDay !== null
        ? {
            battles: row.d28Battles,
            winsPercentage: row.d28WinsPct,
            damagePerBattle: row.d28DamagePerBattle,
            expPerBattle: row.d28ExpPerBattle,
            fragsPerBattle: row.d28FragsPerBattle,
            battlesPerDay: row.d28BattlesPerDay,
          }
        : null,
    wn7: ratings?.wn7 ?? null,
    wn8: ratings?.wn8 ?? null,
    wnx: ratings?.wnx ?? null,
    wnxRecent: ratings?.wnxRecent ?? null,
  };
}

export type ClanMembersCached = {
  members: ClanMemberStats[];
  fromDb: boolean;
  refreshing: boolean;
};

async function periodStatsFromSnapshotsForAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, ClanMemberPeriodStats>> {
  if (accountIds.length === 0) return new Map();
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];

  const playerRows = await db
    .select({
      id: players.id,
      accountId: players.accountId,
      createdAt: players.createdAt,
    })
    .from(players)
    .where(inArray(players.accountId, accountIds));
  if (playerRows.length === 0) return new Map();

  const playerIds = playerRows.map((r) => r.id);
  const snapshotRows = await db
    .select({
      playerId: playerSnapshots.playerId,
      takenAt: playerSnapshots.takenAt,
      battles: playerSnapshots.battles,
      wins: playerSnapshots.wins,
      damageDealt: playerSnapshots.damageDealt,
      frags: playerSnapshots.frags,
      xp: playerSnapshots.xp,
    })
    .from(playerSnapshots)
    .where(inArray(playerSnapshots.playerId, playerIds))
    .orderBy(desc(playerSnapshots.takenAt));

  const latestByPlayer = new Map<number, (typeof snapshotRows)[number]>();
  for (const s of snapshotRows) {
    if (!latestByPlayer.has(s.playerId)) latestByPlayer.set(s.playerId, s);
  }

  const out = new Map<number, ClanMemberPeriodStats>();
  const now = Date.now();
  for (const p of playerRows) {
    const s = latestByPlayer.get(p.id);
    if (!s || s.battles <= 0) continue;
    const created =
      p.createdAt instanceof Date ? p.createdAt.getTime() : null;
    const days = created
      ? Math.max(1, Math.floor((now - created) / 86_400_000))
      : null;
    out.set(Number(p.accountId), {
      battles: s.battles,
      winsPercentage: (s.wins / s.battles) * 100,
      damagePerBattle: Number(s.damageDealt) / s.battles,
      expPerBattle: Number(s.xp) / s.battles,
      fragsPerBattle: s.frags / s.battles,
      battlesPerDay: days ? s.battles / days : 0,
    });
  }
  return out;
}

async function enrichMissingOverall(
  region: Region,
  members: ClanMemberStats[],
): Promise<ClanMemberStats[]> {
  const missing = members.filter((m) => m.overall === null);
  if (missing.length === 0) return members;
  const byAccount = await periodStatsFromSnapshotsForAccounts(
    region,
    missing.map((m) => m.accountId),
  );
  if (byAccount.size === 0) return members;
  return members.map((m) =>
    m.overall === null && byAccount.has(m.accountId)
      ? { ...m, overall: byAccount.get(m.accountId) ?? null }
      : m,
  );
}

export async function getClanMembersCached(
  region: Region,
  clanId: number,
): Promise<ClanMembersCached> {
  const clanMembers = clanMembersByRegion[region];
  const players = playersByRegion[region];
  // LEFT JOIN players: ratings live on the players row (updated by
  // snapshot-cron whenever a fresh tank snapshot lands), so a member whose
  // player hasn't been snapshotted yet gets null ratings — render as "—".
  const rows = await db
    .select({
      member: clanMembers,
      wn7: players.wn7,
      wn8: players.wn8,
      wnx: players.wnx,
      wnxRecent: players.wnxRecent,
    })
    .from(clanMembers)
    .leftJoin(players, eq(clanMembers.accountId, players.accountId))
    .where(eq(clanMembers.clanId, clanId));

  if (rows.length > 0) {
    const oldest = rows.reduce(
      (min, r) => Math.min(min, r.member.refreshedAt.getTime()),
      Number.POSITIVE_INFINITY,
    );
    const stale = Date.now() - oldest > STALE_AFTER_MS;
    if (stale) refreshClanMembersInBackground(region, clanId);
    const enriched = await enrichMissingOverall(
      region,
      rows.map((r) =>
        memberStatsFromRow(r.member, {
          wn7: r.wn7,
          wn8: r.wn8,
          wnx: r.wnx,
          wnxRecent: r.wnxRecent,
        }),
      ),
    );
    return {
      members: enriched,
      fromDb: true,
      refreshing: stale,
    };
  }

  const members = await refreshClanMembers(region, clanId);
  const enriched = await enrichMissingOverall(region, members);
  return { members: enriched, fromDb: false, refreshing: false };
}

export async function refreshClanMembers(
  region: Region,
  clanId: number,
): Promise<ClanMemberStats[]> {
  const clanMembers = clanMembersByRegion[region];
  const members = await getClanMembersStats(region, clanId);
  await db.transaction(async (tx) => {
    await tx.delete(clanMembers).where(eq(clanMembers.clanId, clanId));
    if (members.length > 0) {
      await tx.insert(clanMembers).values(
        members.map((m) => ({
          clanId,
          accountId: m.accountId,
          name: m.name,
          role: m.role,
          roleLocalized: m.roleLocalized,
          roleRank: m.roleRank,
          daysInClan: m.daysInClan,
          lastBattleTime: m.lastBattleTime,
          personalRating: m.personalRating,
          overallBattles: m.overall?.battles ?? null,
          overallWinsPct: m.overall?.winsPercentage ?? null,
          overallDamagePerBattle: m.overall?.damagePerBattle ?? null,
          overallExpPerBattle: m.overall?.expPerBattle ?? null,
          overallFragsPerBattle: m.overall?.fragsPerBattle ?? null,
          overallBattlesPerDay: m.overall?.battlesPerDay ?? null,
          d28Battles: m.d28?.battles ?? null,
          d28WinsPct: m.d28?.winsPercentage ?? null,
          d28DamagePerBattle: m.d28?.damagePerBattle ?? null,
          d28ExpPerBattle: m.d28?.expPerBattle ?? null,
          d28FragsPerBattle: m.d28?.fragsPerBattle ?? null,
          d28BattlesPerDay: m.d28?.battlesPerDay ?? null,
          refreshedAt: new Date(),
        })),
      );
    }
  });
  discoverPlayersBackground(
    region,
    members.map((m) => ({ accountId: m.accountId, nickname: m.name })),
  );
  publish(clanChannel(region, clanId), { kind: "members" });
  return members;
}

function refreshClanMembersInBackground(region: Region, clanId: number): void {
  void dedup(`members:${region}:${clanId}`, () =>
    refreshClanMembers(region, clanId),
  ).catch((err) =>
    console.error(
      `[clans-repo] refreshClanMembers ${region}/${clanId} failed:`,
      err,
    ),
  );
}
