import { sql } from "drizzle-orm";
import {
  mapRatingAggregates,
  mapRatings,
  RATING_PRIOR_WEIGHT,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";

/**
 * Rolling every map vote up into the per-arena table the lists read.
 *
 * The map page never touches this: one arena's votes are an indexed group-by,
 * and running it live is what keeps the page honest the second a vote lands.
 * What cannot be done live is the only thing here, the shrunk mean, because it
 * needs the site-wide prior and that is a fact about every vote in the table
 * rather than about one map.
 *
 * Shorter than the vehicle rollup by the whole second half of it, and the
 * absence is deliberate rather than unfinished. That one also ranks each tank's
 * reputation against its measured win rate inside its own tier, which is the
 * column nothing else on the internet has. A map has no tier to be ranked
 * inside and no measured result to be ranked against: Wargaming publishes no
 * per-arena win rate, and nothing we could accumulate would produce one, since
 * a battle result carries no record of where it was fought. There is no
 * subtraction to make, so there is no column.
 *
 * `RATING_PRIOR_WEIGHT` is imported rather than re-chosen. Twenty votes is
 * where a subject's own average starts outweighing the site's, and that
 * judgement is about how many opinions it takes to mean something, not about
 * whether the subject is a tank or a field.
 */

/**
 * Recompute the whole rollup.
 *
 * One statement, on purpose: doing it per map would be fifty round trips to say
 * something that is one grouped scan plus one cross join.
 *
 * Returns how many arenas ended up with a row.
 */
export async function refreshMapRatingAggregates(): Promise<number> {
  const rows = (await db.execute(sql`
    WITH per_map AS (
      SELECT
        arena_id,
        COUNT(*)                                          AS votes,
        COUNT(*) FILTER (WHERE review_status = 'approved') AS reviews,
        AVG(overall)::real                                AS overall_avg,
        AVG(fun)::real                                    AS fun_avg,
        SUM(overall)                                      AS overall_sum,
        SUM(fun)                                          AS fun_sum,
        STDDEV_SAMP(overall)::real                        AS overall_stddev
      FROM ${mapRatings}
      GROUP BY arena_id
    ),
    -- The prior every map's mean is pulled towards: the site-wide average of
    -- all map votes, not the average of the per-map averages. An arena with
    -- four votes must not get the same say in the prior as one with four
    -- hundred, which is exactly the bias this shrinkage exists to remove.
    --
    -- Taken over the map votes alone rather than over every community vote on
    -- the site. The two populations answer different questions and sit at
    -- different heights: people are far harder on the ground they are sent to
    -- than on the vehicles they chose to buy, and pooling them would drag every
    -- map's shrunk mean towards a tank-shaped middle.
    prior AS (
      SELECT
        COALESCE(AVG(overall), 3)::real AS overall_mean,
        COALESCE(AVG(fun), 3)::real     AS fun_mean
      FROM ${mapRatings}
    )
    INSERT INTO ${mapRatingAggregates} (
      arena_id, votes, reviews,
      overall_avg, fun_avg, overall_bayes, fun_bayes, overall_stddev,
      computed_at
    )
    SELECT
      m.arena_id,
      m.votes,
      m.reviews,
      m.overall_avg,
      m.fun_avg,
      ((${RATING_PRIOR_WEIGHT} * p.overall_mean + m.overall_sum)
        / (${RATING_PRIOR_WEIGHT} + m.votes))::real AS overall_bayes,
      ((${RATING_PRIOR_WEIGHT} * p.fun_mean + m.fun_sum)
        / (${RATING_PRIOR_WEIGHT} + m.votes))::real AS fun_bayes,
      m.overall_stddev,
      NOW()
    FROM per_map m
    CROSS JOIN prior p
    ON CONFLICT (arena_id) DO UPDATE SET
      votes = EXCLUDED.votes,
      reviews = EXCLUDED.reviews,
      overall_avg = EXCLUDED.overall_avg,
      fun_avg = EXCLUDED.fun_avg,
      overall_bayes = EXCLUDED.overall_bayes,
      fun_bayes = EXCLUDED.fun_bayes,
      overall_stddev = EXCLUDED.overall_stddev,
      computed_at = EXCLUDED.computed_at
    RETURNING arena_id
  `)) as unknown as { arena_id: string }[];

  // An arena whose last vote was withdrawn keeps a row saying it scores 4.6 on
  // nothing at all, because the INSERT above only ever sees maps that still
  // have votes. Clearing them here is what makes "absent from this table" mean
  // "nobody has rated it", which is what the board relies on to tell an unrated
  // map from a badly rated one.
  await db.execute(sql`
    DELETE FROM ${mapRatingAggregates}
    WHERE arena_id NOT IN (SELECT arena_id FROM ${mapRatings})
  `);

  return rows.length;
}
