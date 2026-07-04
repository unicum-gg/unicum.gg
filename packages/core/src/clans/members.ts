import type { PortalClanMember } from "@unicum.gg/core/wargaming/wot/clans/members";
import type { WeightedDataPoint } from "@unicum.gg/core/lib/stats";

/** Per-member computed ratings (WN7/WN8/WNX). Owned here; the web render
 * facade (`wargaming/wot/clans/ratings`) imports it. */
export type MemberRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export {
  ClanRole,
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
