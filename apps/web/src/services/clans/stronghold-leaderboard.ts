import { sql } from "drizzle-orm";
import {
  SRB_VOLUME_K,
  STRONGHOLD_MIN_BATTLES,
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
  strongholdRatingsByRegion,
  type ClanRankBadge,
  type ClanStrongholdSr,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

export type StrongholdLeaderboardEntry = {
  clanId: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  languages: string[];
  membersCount: number;
  elo: number | null;
  /** Battles over the selected period (all-time, or the last-30-days diff). */
  battles: number;
  /** Wins over the selected period. */
  wins: number;
  /** Median WG Personal Rating (WGR) of the clan's roster. */
  personalRating: number | null;
  /** Share of the roster that reads as boost accounts, by low random-battle count (0..1). */
  boostRatio: number | null;
  /** Composite skirmish rating for the period: roster x win rate x volume x maturity. */
  sr: number | null;
  /** Battles-based SR: the same rating with battle volume rewarded, not just gated. */
  srb: number | null;
  /** Leaderboard placings, attached by the route (this query ranks one board,
   * the badges span all of them). */
  badges?: ClanRankBadge[];
};

// SRB is SR bumped by a volume bonus that only ever adds (>= SR), on a single
// absolute scale across tiers (see SRB_VOLUME_K in shared). Computed inline from
// the materialized sr + battles.
function srbSql() {
  return sql`round(sr::float * (1 + ln(1 + battles::float / ${SRB_VOLUME_K})))`;
}

// Column each sort orders by. Battles/wins/sr in the row are already the
// period's values, so the sort is a plain column (win rate is derived from the
// stored battles/wins). NULLS LAST keeps clans missing a metric off the top.
function orderExpr(sort: StrongholdSort) {
  switch (sort) {
    case StrongholdSort.Elo:
      return sql`elo DESC NULLS LAST`;
    case StrongholdSort.Battles:
      return sql`battles DESC NULLS LAST`;
    case StrongholdSort.Winrate:
      return sql`CASE WHEN battles > 0 THEN wins::float / battles ELSE NULL END DESC NULLS LAST`;
    case StrongholdSort.RatingBattles:
      return sql`${srbSql()} DESC NULLS LAST`;
    case StrongholdSort.Rating:
      return sql`sr DESC NULLS LAST`;
  }
}

/**
 * Region-scoped stronghold leaderboard for one (tier, period), sorted and capped
 * to the top `limit`. Reads the materialized `stronghold_ratings` table
 * (refreshed hourly by the top-clans cron from the snapshots x members
 * aggregation) as a cheap indexed scan on `(tier, period, sr DESC)` — no
 * per-request aggregation and no cache, so switching sort/period is instant
 * instead of paying the ~3s CTE on a cold cache.
 */
export async function getStrongholdLeaderboard(
  region: Region,
  tier: StrongholdTier,
  sort: StrongholdSort,
  period: StrongholdPeriod,
  limit: number,
): Promise<StrongholdLeaderboardEntry[]> {
  const table = strongholdRatingsByRegion[region];
  // Min-battles floor: SR has no volume brake, so a floor keeps a tiny lucky
  // sample off the board. `battles` is the period's count, so the 30-day board
  // uses a lighter floor (a third) than the all-time one, or a bursty Advances
  // 30d board would go near-empty.
  const minBattles =
    period === StrongholdPeriod.Overall
      ? STRONGHOLD_MIN_BATTLES[tier]
      : Math.ceil(STRONGHOLD_MIN_BATTLES[tier] / 3);
  const rows = (await db.execute(sql`
    SELECT
      clan_id, tag, name, color, COALESCE(emblem, '') AS emblem, languages,
      members_count, elo, battles, wins, personal_rating, boost_ratio, sr,
      ${srbSql()} AS srb
    FROM ${table}
    WHERE tier = ${tier} AND period = ${period} AND is_active
      AND battles >= ${minBattles}
    ORDER BY ${orderExpr(sort)}
    LIMIT ${sql.raw(String(limit))}
  `)) as unknown as Array<{
    clan_id: string | number;
    tag: string;
    name: string;
    color: string;
    emblem: string;
    languages: string[] | null;
    members_count: number;
    elo: number | null;
    battles: number;
    wins: number;
    personal_rating: number | null;
    boost_ratio: number | string | null;
    sr: number | string | null;
    srb: number | string | null;
  }>;

  return rows.map((r) => ({
    clanId: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages ?? [],
    membersCount: Number(r.members_count),
    elo: r.elo === null ? null : Number(r.elo),
    battles: Number(r.battles),
    wins: Number(r.wins),
    personalRating:
      r.personal_rating === null ? null : Number(r.personal_rating),
    boostRatio: r.boost_ratio === null ? null : Number(r.boost_ratio),
    sr: r.sr === null ? null : Number(r.sr),
    srb: r.srb === null ? null : Number(r.srb),
  }));
}

/**
 * The clan's current (overall) SR per mode/tier, read from the materialized
 * `stronghold_ratings` table (the same SR the boards rank by). Returns null per
 * tier when the clan is below the ranking threshold or the region is unseeded.
 * Powers the SR rows in the clan page's stronghold section.
 */
export async function getClanStrongholdSr(
  region: Region,
  clanId: number,
): Promise<{ overall: ClanStrongholdSr; d30: ClanStrongholdSr }> {
  const table = strongholdRatingsByRegion[region];
  const rows = (await db.execute(sql`
    SELECT tier, period, sr
    FROM ${table}
    WHERE clan_id = ${clanId}
  `)) as unknown as Array<{
    tier: string;
    period: string;
    sr: number | string | null;
  }>;
  const build = (period: StrongholdPeriod): ClanStrongholdSr => {
    const byTier = new Map(
      rows
        .filter((r) => r.period === period)
        .map((r) => [r.tier, r.sr === null ? null : Number(r.sr)]),
    );
    return {
      advances: byTier.get(StrongholdTier.Advances) ?? null,
      t10: byTier.get(StrongholdTier.T10) ?? null,
      t8: byTier.get(StrongholdTier.T8) ?? null,
      t6: byTier.get(StrongholdTier.T6) ?? null,
    };
  };
  return {
    overall: build(StrongholdPeriod.Overall),
    d30: build(StrongholdPeriod.Month),
  };
}
