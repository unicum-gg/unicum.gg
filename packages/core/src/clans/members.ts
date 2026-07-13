import type { PortalClanMember } from "@unicum.gg/core/wargaming/wot/clans/members";
import { type WeightedDataPoint, weightedAverage } from "@unicum.gg/core/lib/stats";

/** Per-member computed ratings (WN7/WN8/WNX). Owned here; the web render
 * facade (`wargaming/wot/clans/ratings`) imports it. */
export type MemberRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export {
  ClanRole,
  getClanMembersBatch,
  getClanMembersStats,
} from "@unicum.gg/core/wargaming/wot/clans/members";
export type {
  ClanMemberPeriodStats,
  PortalClanMember,
} from "@unicum.gg/core/wargaming/wot/clans/members";

// Enriched clan member: raw WG portal data (from the SDK) + our WNX/WN8
// ratings, computed in `refreshClanMembers` from tank snapshots (the cron
// path is the single source of truth). `wnx30d` + `battles30d` cover a
// 30-day window (matches the player page "Last 30d" column); the clan
// aggregate weights by `battles30d`.
export type ClanMemberStats = PortalClanMember &
  MemberRatings & {
    wn730d: number | null;
    wn830d: number | null;
    wnx30d: number | null;
    battles30d: number | null;
  };

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

/** A clan's battle-weighted aggregate ratings over its members. Single source
 * for the clan page header, the `/{tag}` overview endpoint and the Discord bot:
 * lifetime WN7/WN8/WNX weighted by lifetime battles, the same over the 30-day
 * window weighted by recent battles, and the lifetime average win rate. */
export type ClanRatings = {
  lifetime: { wn7: number | null; wn8: number | null; wnx: number | null };
  recent: { wn7: number | null; wn8: number | null; wnx: number | null };
  avgWinrate: number | null;
};

export function computeClanRatings(members: ClanMemberStats[]): ClanRatings {
  return {
    lifetime: {
      wn7: weightedAverage(overallPoints(members, (m) => m.wn7)),
      wn8: weightedAverage(overallPoints(members, (m) => m.wn8)),
      wnx: weightedAverage(overallPoints(members, (m) => m.wnx)),
    },
    recent: {
      wn7: weightedAverage(d30Points(members, (m) => m.wn730d)),
      wn8: weightedAverage(d30Points(members, (m) => m.wn830d)),
      wnx: weightedAverage(d30Points(members, (m) => m.wnx30d)),
    },
    avgWinrate: weightedAverage(
      overallPoints(members, (m) => m.overall?.winsPercentage ?? null),
    ),
  };
}
