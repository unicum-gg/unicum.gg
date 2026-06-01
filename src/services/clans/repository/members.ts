import { and, eq } from "drizzle-orm";
import { db } from "@/services/db";
import { type ClanMember, clanMembers } from "@/services/db/schema";
import { discoverPlayersBackground } from "@/services/discovery/players";
import { clanChannel, publish } from "@/services/live/pubsub";
import type { Region } from "@/services/wargaming/wot";
import {
  type ClanMemberStats,
  getClanMembersStats,
} from "@/services/wargaming/wot/clans/members";
import { dedup, STALE_AFTER_MS } from "./internal";

function memberStatsFromRow(row: ClanMember): ClanMemberStats {
  return {
    accountId: Number(row.accountId),
    name: row.name,
    role: row.role,
    roleLocalized: row.roleLocalized,
    roleRank: row.roleRank,
    daysInClan: row.daysInClan,
    lastBattleTime: row.lastBattleTime,
    personalRating: row.personalRating,
    overall: {
      battles: row.overallBattles,
      winsPercentage: row.overallWinsPct,
      damagePerBattle: row.overallDamagePerBattle,
      expPerBattle: row.overallExpPerBattle,
      fragsPerBattle: row.overallFragsPerBattle,
      battlesPerDay: row.overallBattlesPerDay,
    },
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
  };
}

export type ClanMembersCached = {
  members: ClanMemberStats[];
  fromDb: boolean;
  refreshing: boolean;
};

export async function getClanMembersCached(
  region: Region,
  clanId: number,
): Promise<ClanMembersCached> {
  const rows = await db
    .select()
    .from(clanMembers)
    .where(and(eq(clanMembers.region, region), eq(clanMembers.clanId, clanId)));

  if (rows.length > 0) {
    const oldest = rows.reduce(
      (min, r) => Math.min(min, r.refreshedAt.getTime()),
      Number.POSITIVE_INFINITY,
    );
    const stale = Date.now() - oldest > STALE_AFTER_MS;
    if (stale) refreshClanMembersInBackground(region, clanId);
    return {
      members: rows.map(memberStatsFromRow),
      fromDb: true,
      refreshing: stale,
    };
  }

  const members = await refreshClanMembers(region, clanId);
  return { members, fromDb: false, refreshing: false };
}

export async function refreshClanMembers(
  region: Region,
  clanId: number,
): Promise<ClanMemberStats[]> {
  const members = await getClanMembersStats(region, clanId);
  await db.transaction(async (tx) => {
    await tx
      .delete(clanMembers)
      .where(
        and(eq(clanMembers.region, region), eq(clanMembers.clanId, clanId)),
      );
    if (members.length > 0) {
      await tx.insert(clanMembers).values(
        members.map((m) => ({
          region,
          clanId,
          accountId: m.accountId,
          name: m.name,
          role: m.role,
          roleLocalized: m.roleLocalized,
          roleRank: m.roleRank,
          daysInClan: m.daysInClan,
          lastBattleTime: m.lastBattleTime,
          personalRating: m.personalRating,
          overallBattles: m.overall.battles,
          overallWinsPct: m.overall.winsPercentage,
          overallDamagePerBattle: m.overall.damagePerBattle,
          overallExpPerBattle: m.overall.expPerBattle,
          overallFragsPerBattle: m.overall.fragsPerBattle,
          overallBattlesPerDay: m.overall.battlesPerDay,
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
