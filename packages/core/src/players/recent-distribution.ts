import { sql } from "drizzle-orm";
import {
  type DistributionBucket,
  playersByRegion,
  RATING_DOMAINS,
  RATING_RANGES,
  RECENT_DISTRIBUTION_MIN_BATTLES,
  type RecentDistribution,
  WINRATE_DOMAIN,
  WINRATE_RANGE,
  WN_RATING_METRICS,
  type WnRatingMetric,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { type BucketRow, toBuckets } from "./distribution-buckets";

/**
 * The same histograms over the last 30 days, against the accounts that played
 * at least `RECENT_DISTRIBUTION_MIN_BATTLES` in that window.
 *
 * Read off the window columns `*_players` already carries, which are what the
 * profile's 30-day column prints, so the percentile situates the very number
 * the reader sees beside it. Gated on `last_battle_at` like every reader of
 * those columns (`recentColumn`): they are written when a snapshot lands, so an
 * account that stopped playing keeps its last window until the hourly window
 * refresh catches up with it. Same single-denominator rule as the career
 * sample, so one "against N accounts" line holds for every bar. Its own scan
 * rather than a branch of the career one: the two samples share no row filter,
 * and this one is a fraction of the table (19.6k accounts of 229k on Asia,
 * ~1.1s on EU). The idle gate is not cosmetic: without it, 4,500 of the Asia
 * sample are accounts whose last battle is over a month old.
 */
export async function readRecentHistograms(region: Region): Promise<BucketRow[]> {
  const t = playersByRegion[region];
  const branches = WN_RATING_METRICS.map((metric) => {
    const col = sql.raw(`"${metric}"`);
    const range = RATING_RANGES[metric];
    return sql`SELECT ${sql.raw(`'${metric}'`)} AS metric,
               width_bucket(${col}, ${range.min}, ${range.max}, ${range.steps})::int AS bucket,
               count(*)::int AS n
        FROM sample GROUP BY 2`;
  });
  return db.execute<BucketRow>(
    sql`WITH sample AS MATERIALIZED (
          SELECT wins_30d::double precision / battles_30d AS winrate,
                 wn7_30d AS wn7, wn8_30d AS wn8, wnx_30d AS wnx
          FROM ${t}
          WHERE battles_30d >= ${RECENT_DISTRIBUTION_MIN_BATTLES}
            AND wins_30d IS NOT NULL
            AND last_battle_at >= now() - interval '30 days'
            AND wn7_30d IS NOT NULL
            AND wn8_30d IS NOT NULL
            AND wnx_30d IS NOT NULL
        )
        SELECT 'winrate' AS metric,
               width_bucket(winrate, ${WINRATE_RANGE.min}, ${WINRATE_RANGE.max}, ${WINRATE_RANGE.steps})::int AS bucket,
               count(*)::int AS n
        FROM sample GROUP BY 2
        UNION ALL
        ${sql.join(branches, sql` UNION ALL `)}`,
  );
}

export function toRecentDistribution(rows: BucketRow[]): RecentDistribution {
  const winrate = toBuckets(rows, "winrate", WINRATE_RANGE, WINRATE_DOMAIN);
  return {
    minBattles: RECENT_DISTRIBUTION_MIN_BATTLES,
    players: winrate.reduce((sum, b) => sum + b.count, 0),
    winrate,
    ratings: Object.fromEntries(
      WN_RATING_METRICS.map((metric) => [
        metric,
        toBuckets(rows, metric, RATING_RANGES[metric], RATING_DOMAINS[metric]),
      ]),
    ) as Record<WnRatingMetric, DistributionBucket[]>,
  };
}
