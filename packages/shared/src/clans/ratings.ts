import type { PortalClanMember } from "@unicum.gg/wargaming";
import { type WeightedDataPoint, weightedAverage } from "../lib/stats";

/** Per-member computed ratings (WN7/WN8/WNX). */
export type MemberRatings = {
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

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
    // Public badges, attached at the API boundary (absent in the cron/cache
    // path). The owner connected this account on the site, is an active
    // non-anonymous supporter, and/or has a linked Twitch channel.
    isVerified?: boolean;
    isSupporter?: boolean;
    twitchLogin?: string | null;
    // The winner's crest, from the same resolver as the three above. It already
    // returned these and the members endpoint dropped them, so a member who had
    // won a tournament wore the crest on the leaderboards and nothing in their
    // own clan's roster.
    tournamentWins?: number;
    tournamentFeaturedWins?: number;
    tournamentBestTitle?: string | null;
  };

// Boost detection. A member reads as a "boost account" (an account with very
// few random battles, farmed only in stronghold to inflate a clan's results) by
// a soft weight that approaches 1 as its lifetime random battles approach 0.
// `SR_BOOST_SCALE` sets how fast that weight decays with battle count; the SR
// materialization uses the same constant in SQL, so it lives here as the single
// source. `BOOST_BADGE_MIN` is the roster share above which the warning badge
// shows (below it every clan carries a handful, not worth flagging).
export const SR_BOOST_SCALE = 2000;
export const BOOST_BADGE_MIN = 0.15;

/**
 * Share of a clan's roster (0..1) that reads as boost accounts: the mean
 * per-member boost weight `1 / (1 + (battles / SR_BOOST_SCALE)^2)` over members
 * whose lifetime battle count is known. Mirrors the SQL in the SR materialization
 * so the clan page and the leaderboard agree. Null when no member has stats.
 */
export function rosterBoostRatio(members: ClanMemberStats[]): number | null {
  let sum = 0;
  let n = 0;
  for (const m of members) {
    const battles = m.overall?.battles;
    if (battles == null) continue;
    sum += 1 / (1 + Math.pow(battles / SR_BOOST_SCALE, 2));
    n++;
  }
  return n > 0 ? sum / n : null;
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
