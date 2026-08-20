import { sql } from "drizzle-orm";
import {
  playersByRegion,
  RATING_PRIOR_WEIGHT,
  tankRatingAggregates,
  tankRatings,
  tankStatsByRegion,
  vehiclesByRegion,
  VoterBracket,
} from "@unicum.gg/shared";
import { Region, REGIONS } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";

/**
 * Rolling every vote up into the per-tank table the catalogue pages read.
 *
 * The tank page never touches this: one vehicle's votes are an indexed
 * group-by, and running it live is what keeps the page honest the second a vote
 * lands. What cannot be done live is anything that compares tanks to each
 * other, which is everything below: the shrunk mean needs the site-wide prior,
 * and the over/underrated gap needs every vehicle in the tier ranked twice.
 */

// Half past the hour, out of the way of the leaderboard recompute that runs on
// it. This is a single pass over a table measured in thousands of rows, so the
// cadence is set by how fresh a board should feel rather than by cost.
const RATINGS_AGGREGATE_SCHEDULE = "30 * * * *";

/**
 * The server the measured half of `hype` is read from.
 *
 * A tank is balanced identically on all three, so its real win rate is one
 * fact, not three, and the honest way to estimate one fact is from the largest
 * sample. EU is that sample by a wide margin. Reading each region separately
 * would produce three different verdicts about the same vehicle, differing
 * mostly by how many players we track there.
 */
const MEASURED_REGION = Region.EU;

/**
 * Rated vehicles a tier needs before either percentile means anything.
 *
 * A rank is a position in a population, so a population of one puts its only
 * member at zero and a population of two puts them at zero and one. Both are
 * arithmetically correct and neither says anything about the tank, which is
 * exactly the trap: the two zeroes subtract to a gap of nothing, and the page
 * would announce that reputation and results agree about a vehicle that has
 * been compared to nothing at all.
 *
 * Eight is where a percentile starts carrying more signal than granularity. In
 * the early weeks most tiers sit below it and the column is simply absent,
 * which is the honest state and the one the page is built to render.
 */
const MIN_TIER_POPULATION = 8;

/**
 * Recompute the whole rollup.
 *
 * One statement, on purpose. Doing it per tank would be eleven hundred round
 * trips to say something that is a single window function, and the percentiles
 * are only meaningful when every vehicle in a tier is ranked in the same pass:
 * computing them tank by tank would rank each one against a table that is
 * changing underneath it.
 *
 * Returns how many vehicles ended up with a row.
 */
export async function refreshTankRatingAggregates(): Promise<number> {
  const vehicles = vehiclesByRegion[MEASURED_REGION];
  const tankStats = tankStatsByRegion[MEASURED_REGION];

  const rows = (await db.execute(sql`
    WITH per_tank AS (
      SELECT
        tank_id,
        COUNT(*)                                        AS votes,
        COUNT(*) FILTER (WHERE review_status = 'approved') AS reviews,
        AVG(overall)::real                              AS overall_avg,
        AVG(fun)::real                                  AS fun_avg,
        SUM(overall)                                    AS overall_sum,
        SUM(fun)                                        AS fun_sum,
        STDDEV_SAMP(overall)::real                      AS overall_stddev
      FROM ${tankRatings}
      GROUP BY tank_id
    ),
    -- The prior every tank's mean is pulled towards: the site-wide average of
    -- all votes, not the average of the per-tank averages. A tank with four
    -- votes must not get the same say in the prior as one with four hundred,
    -- which is exactly the bias this whole shrinkage exists to remove.
    prior AS (
      SELECT
        COALESCE(AVG(overall), 3)::real AS overall_mean,
        COALESCE(AVG(fun), 3)::real     AS fun_mean
      FROM ${tankRatings}
    ),
    shrunk AS (
      SELECT
        t.*,
        v.tier,
        s.winrate AS measured_winrate,
        -- The population both percentiles below are taken over: the tier's
        -- rated vehicles that also have a measured win rate. Guarded on further
        -- down, because a rank inside a set of one is 0 by definition and the
        -- two zeroes would subtract to a gap of exactly nothing, which the page
        -- would then report as "reputation and results agree" about a tank
        -- nothing has been compared to.
        COUNT(*) OVER (PARTITION BY v.tier, (s.winrate IS NULL)) AS tier_rated,
        ((${RATING_PRIOR_WEIGHT} * p.overall_mean + t.overall_sum)
          / (${RATING_PRIOR_WEIGHT} + t.votes))::real AS overall_bayes,
        ((${RATING_PRIOR_WEIGHT} * p.fun_mean + t.fun_sum)
          / (${RATING_PRIOR_WEIGHT} + t.votes))::real AS fun_bayes
      FROM per_tank t
      CROSS JOIN prior p
      LEFT JOIN ${vehicles} v ON v.tank_id = t.tank_id
      LEFT JOIN ${tankStats} s ON s.tank_id = t.tank_id
    ),
    -- Both halves of the gap, as ranks inside the vehicle's own tier. Comparing
    -- a tier II's win rate to a tier X's would say nothing: matchmaking makes
    -- the whole scale move with the tier. PERCENT_RANK puts the worst of a tier
    -- at 0 and the best at 1, so the subtraction below is in the same units on
    -- both sides.
    --
    -- Both are taken over the SAME population, and the partition says so
    -- explicitly: the tier's rated vehicles THAT ALSO HAVE a measured win rate.
    --
    -- Splitting on measured_winrate IS NULL is not decoration. PERCENT_RANK
    -- divides by the partition size, and a row whose value is NULL still sits
    -- in the window and still sorts (last, under ASC). Left in, a tier with ten
    -- unmeasured vehicles among thirty rated ones pushed its best real win rate
    -- to rank 20 of 30, so measured topped out near 0.66 while perceived
    -- still spanned the full range, and every hype value in that tier drifted
    -- towards "overrated" by the size of the hole. Ranking the two halves over
    -- different sets would likewise make their difference measure which tanks
    -- people bothered to rate rather than anything about the tanks.
    --
    -- The perceived side ranks on the shrunk mean rather than the raw one, so a
    -- five-vote tank cannot be declared the most underrated vehicle in the game
    -- on the strength of five people liking it.
    ranked AS (
      SELECT
        tank_id,
        votes,
        reviews,
        overall_avg,
        fun_avg,
        overall_bayes,
        fun_bayes,
        overall_stddev,
        CASE WHEN tier IS NULL OR measured_winrate IS NULL OR tier_rated < ${MIN_TIER_POPULATION} THEN NULL ELSE
          PERCENT_RANK() OVER (
            PARTITION BY tier, (measured_winrate IS NULL) ORDER BY overall_bayes
          )
        END::real AS perceived_percentile,
        CASE WHEN tier IS NULL OR measured_winrate IS NULL OR tier_rated < ${MIN_TIER_POPULATION} THEN NULL ELSE
          PERCENT_RANK() OVER (
            PARTITION BY tier, (measured_winrate IS NULL) ORDER BY measured_winrate
          )
        END::real AS measured_percentile
      FROM shrunk
    )
    INSERT INTO ${tankRatingAggregates} (
      tank_id, votes, reviews,
      overall_avg, fun_avg, overall_bayes, fun_bayes, overall_stddev,
      perceived_percentile, measured_percentile, hype, computed_at
    )
    SELECT
      tank_id, votes, reviews,
      overall_avg, fun_avg, overall_bayes, fun_bayes, overall_stddev,
      perceived_percentile, measured_percentile,
      (perceived_percentile - measured_percentile)::real AS hype,
      NOW()
    FROM ranked
    ON CONFLICT (tank_id) DO UPDATE SET
      votes = EXCLUDED.votes,
      reviews = EXCLUDED.reviews,
      overall_avg = EXCLUDED.overall_avg,
      fun_avg = EXCLUDED.fun_avg,
      overall_bayes = EXCLUDED.overall_bayes,
      fun_bayes = EXCLUDED.fun_bayes,
      overall_stddev = EXCLUDED.overall_stddev,
      perceived_percentile = EXCLUDED.perceived_percentile,
      measured_percentile = EXCLUDED.measured_percentile,
      hype = EXCLUDED.hype,
      computed_at = EXCLUDED.computed_at
    RETURNING tank_id
  `)) as unknown as { tank_id: number }[];

  // A vehicle whose last vote was withdrawn keeps a row saying it scores 4.6 on
  // nothing at all, because the INSERT above only ever sees tanks that still
  // have votes. Clearing them here is what makes "absent from this table" mean
  // "nobody has rated it", which is what the board relies on to tell an unrated
  // tank from a badly rated one.
  await db.execute(sql`
    DELETE FROM ${tankRatingAggregates}
    WHERE tank_id NOT IN (SELECT tank_id FROM ${tankRatings})
  `);

  return rows.length;
}

/**
 * Keep the stored bracket in step with how the voter plays now.
 *
 * A vote records who cast it at the moment it was cast, which is right for the
 * evidence columns about the TANK: the opinion rested on that record and
 * rewriting it would be rewriting history.
 *
 * The three columns about the VOTER are the exception, and they move together:
 * the bracket is the axis the community split is read on, and the account
 * rating and battle count are what the reviews print beside a name. Left
 * frozen, a player who was average two years ago goes on speaking for the
 * average bracket forever, and the "unicums rate it higher" line slowly stops
 * being true of anybody.
 *
 * Cut on the same boundaries `voterBracket` uses. Kept in SQL rather than read
 * back through it, so this is one statement over the table instead of a row per
 * vote.
 */
export async function refreshVoterBrackets(): Promise<void> {
  // One branch per region, because the players tables are physically separate
  // and a vote carries the region it was cast from. Built rather than written
  // out so adding a fourth server is a change to `REGIONS`, not to this query.
  const branches = REGIONS.map(
    (region) => sql`
      SELECT account_id, wn8, battles, ${region} AS region
      FROM ${playersByRegion[region]}
    `,
  );

  await db.execute(sql`
    UPDATE ${tankRatings} r
    SET
      player_wn8 = p.wn8,
      player_battles = p.battles,
      -- The same cuts voterBracket applies, restated here because the update
      -- has to happen in the database: reading a million votes back through
      -- TypeScript to relabel them would be a million round trips to compute
      -- four comparisons.
      bracket = CASE
        WHEN p.wn8 IS NULL THEN ${VoterBracket.Unknown}
        WHEN p.wn8 < 900 THEN ${VoterBracket.Learning}
        WHEN p.wn8 < 1600 THEN ${VoterBracket.Average}
        WHEN p.wn8 < 2350 THEN ${VoterBracket.Strong}
        ELSE ${VoterBracket.Unicum}
      END
    FROM (${sql.join(branches, sql` UNION ALL `)}) p
    WHERE p.account_id = r.account_id
      AND p.region = r.region
      -- Only the rows that actually move. Postgres writes a new tuple version
      -- for every row an UPDATE touches whether or not the values changed, so
      -- an unguarded statement rewrites the whole table every hour and leaves
      -- that many dead tuples and that much WAL behind it. Most accounts do not
      -- change bracket between two ticks. This project has already had the
      -- shared database fall over under an hourly recompute burst.
      AND (r.player_wn8, r.player_battles, r.bracket) IS DISTINCT FROM (
        p.wn8,
        p.battles,
        CASE
          WHEN p.wn8 IS NULL THEN ${VoterBracket.Unknown}
          WHEN p.wn8 < 900 THEN ${VoterBracket.Learning}
          WHEN p.wn8 < 1600 THEN ${VoterBracket.Average}
          WHEN p.wn8 < 2350 THEN ${VoterBracket.Strong}
          ELSE ${VoterBracket.Unicum}
        END
      )
  `);
}

export function startTankRatingsCron(): boolean {
  return scheduleCron("tank-ratings-cron", RATINGS_AGGREGATE_SCHEDULE, async () => {
    // Brackets first: the rollup does not read them, but the tank page's split
    // does, and refreshing them in the same tick keeps the two consistent.
    await refreshVoterBrackets();
    const tanks = await refreshTankRatingAggregates();
    console.log(`[tank-ratings-cron] rolled up ${tanks} vehicles`);
  });
}
