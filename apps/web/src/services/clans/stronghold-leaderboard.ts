import { sql } from "drizzle-orm";
import {
  StrongholdPeriod,
  StrongholdSort,
  StrongholdTier,
  strongholdRatingsByRegion,
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
};

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
  const rows = (await db.execute(sql`
    SELECT
      clan_id, tag, name, color, COALESCE(emblem, '') AS emblem, languages,
      members_count, elo, battles, wins, personal_rating, boost_ratio, sr
    FROM ${table}
    WHERE tier = ${tier} AND period = ${period}
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
  }));
}
