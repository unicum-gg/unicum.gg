import type { WeightedDataPoint } from "@/lib/stats";
import {
  type Region,
  REGION_PORTAL_HOST,
} from "@/services/wargaming/wot";
import { portalFetch } from "@/services/wargaming/wot/fetch";
import type { MemberRatings } from "./ratings";

type PortalMemberRaw = {
  id: number;
  name: string;
  role: {
    name: string;
    localized_name: string;
    rank: number;
    order: number;
  };
  days_in_clan: number | null;
  last_battle_time: number | null;
  personal_rating: number | null;
  battles_count: number | null;
  wins_percentage: number | null;
  damage_per_battle: number | null;
  exp_per_battle: number | null;
  frags_per_battle: number | null;
  battles_per_day: number | null;
  abnormal_results: boolean;
  is_press: boolean;
};

type PortalMembersResponse = {
  status: string;
  items: PortalMemberRaw[];
};

export enum ClanRole {
  Commander = "commander",
  ExecutiveOfficer = "executive_officer",
  PersonnelOfficer = "personnel_officer",
  CombatOfficer = "combat_officer",
  IntelligenceOfficer = "intelligence_officer",
  Quartermaster = "quartermaster",
  Diplomat = "diplomat",
  Recruiter = "recruiter",
  Treasurer = "treasurer",
  JuniorOfficer = "junior_officer",
  Private = "private",
  Recruit = "recruit",
  Reservist = "reservist",
}

export type ClanMemberPeriodStats = {
  battles: number;
  winsPercentage: number;
  damagePerBattle: number;
  expPerBattle: number;
  fragsPerBattle: number;
  battlesPerDay: number;
};

// Pre-computed ratings cached on the clan_members row by refreshClanMembers,
// so the clan page can render the table fully populated on first paint
// instead of streaming a 100-member compute via Suspense.
// `wnx30d` + `battles30d` cover a 30-day window (matches the player
// page "Last 30d" column); the clan aggregate weights by `battles30d`.
export type ClanMemberStats = {
  accountId: number;
  name: string;
  role: ClanRole;
  roleLocalized: string;
  roleRank: number;
  daysInClan: number;
  lastBattleTime: Date | null;
  personalRating: number | null;
  overall: ClanMemberPeriodStats | null;
  d28: ClanMemberPeriodStats | null;
  wn730d: number | null;
  wn830d: number | null;
  wnx30d: number | null;
  battles30d: number | null;
} & MemberRatings;

function periodStatsFromRaw(
  raw: PortalMemberRaw,
): ClanMemberPeriodStats | null {
  // WG flags long-inactive accounts with `abnormal_results: true` and returns
  // null stats for them in this endpoint, even when the same account has stats
  // exposed via the public API. Treat partial nulls as "no stats".
  if (
    raw.battles_count === null ||
    raw.wins_percentage === null ||
    raw.damage_per_battle === null ||
    raw.exp_per_battle === null ||
    raw.frags_per_battle === null ||
    raw.battles_per_day === null
  ) {
    return null;
  }
  return {
    battles: raw.battles_count,
    winsPercentage: raw.wins_percentage,
    damagePerBattle: raw.damage_per_battle,
    expPerBattle: raw.exp_per_battle,
    fragsPerBattle: raw.frags_per_battle,
    battlesPerDay: raw.battles_per_day,
  };
}

async function fetchClanMembersTimeframe(
  region: Region,
  clanId: number,
  timeframe: "all" | "28",
): Promise<PortalMemberRaw[]> {
  const url = new URL(
    `https://${REGION_PORTAL_HOST[region]}/clans/wot/${clanId}/api/players/`,
  );
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "500");
  url.searchParams.set("order", "-personal_rating");
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("battle_type", "default");
  const body = await portalFetch<PortalMembersResponse>(url);
  return body.items ?? [];
}

export async function getClanMembersStats(
  region: Region,
  clanId: number,
): Promise<ClanMemberStats[]> {
  const [allRaws, d28Raws] = await Promise.all([
    fetchClanMembersTimeframe(region, clanId, "all"),
    fetchClanMembersTimeframe(region, clanId, "28"),
  ]);
  const d28ByAccount = new Map<number, PortalMemberRaw>();
  for (const m of d28Raws) d28ByAccount.set(m.id, m);

  return allRaws.map((m) => {
    const d28 = d28ByAccount.get(m.id);
    return {
      accountId: m.id,
      name: m.name,
      role: m.role.name as ClanRole,
      roleLocalized: m.role.localized_name,
      roleRank: m.role.rank,
      daysInClan: m.days_in_clan ?? 0,
      lastBattleTime: m.last_battle_time
        ? new Date(m.last_battle_time * 1000)
        : null,
      personalRating: m.personal_rating,
      overall: periodStatsFromRaw(m),
      d28: d28 ? periodStatsFromRaw(d28) : null,
      // Ratings are computed in `refreshClanMembers` from tank snapshots,
      // not from the portal payload — leave null here so the cron path is
      // the single source of truth.
      wn7: null,
      wn8: null,
      wnx: null,
      wn730d: null,
      wn830d: null,
      wnx30d: null,
      battles30d: null,
    };
  });
}

/**
 * Build battle-weighted points for clan-aggregate ratings derived from a
 * member's lifetime stats (overall WNX, lifetime winrate). Weight is the
 * member's lifetime battle count, so veterans outweigh freshmen.
 */
export function overallPoints(
  members: ClanMemberStats[],
  getValue: (m: ClanMemberStats) => number | null,
): WeightedDataPoint[] {
  const points: WeightedDataPoint[] = [];
  for (const m of members) {
    const value = getValue(m);
    if (value === null || !m.overall || m.overall.battles <= 0) continue;
    points.push({ value, weight: m.overall.battles });
  }
  return points;
}

/**
 * Build battle-weighted points for clan-aggregate "recent" ratings using
 * the 30-day window cached on the players row. Weight is `battles30d`,
 * so a member who stopped playing weeks ago (huge lifetime totals, zero
 * recent) doesn't poison the recent view.
 */
export function d30Points(
  members: ClanMemberStats[],
  getValue: (m: ClanMemberStats) => number | null,
): WeightedDataPoint[] {
  const points: WeightedDataPoint[] = [];
  for (const m of members) {
    const value = getValue(m);
    if (value === null || m.battles30d === null || m.battles30d <= 0)
      continue;
    points.push({ value, weight: m.battles30d });
  }
  return points;
}
