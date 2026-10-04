import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { refreshVoterBrackets } from "@unicum.gg/core/community/voter-brackets";
import { refreshMapRatingAggregates } from "@unicum.gg/core/maps/ratings-aggregate";
import { refreshTankRatingAggregates } from "@unicum.gg/core/tanks/ratings-aggregate";

/**
 * Everything about the community votes that compares them to each other.
 *
 * One tick for both subjects rather than one per feature, which is what made
 * this its own module. The three jobs below are a single pass over the same
 * body of votes: a shrunk mean needs the prior of every vote in its table, and
 * the brackets are one fact about the accounts that cast them. Split across two
 * leases, the bracket refresh would either run twice to learn the same thing or
 * sit in one feature's cron silently keeping the other one's splits honest,
 * which is the kind of coupling nobody finds until it breaks.
 *
 * Neither page reads any of it to draw one subject. A tank's own votes and a
 * map's own votes are indexed group-bys the endpoints run live, which is what
 * keeps a page honest the second a vote lands. What cannot be done live is
 * exactly what is here.
 */

// Half past the hour, out of the way of the leaderboard recompute that runs on
// it. These are single passes over tables measured in thousands of rows, so the
// cadence is set by how fresh a board should feel rather than by cost.
const RATINGS_AGGREGATE_SCHEDULE = "30 * * * *";

export function startCommunityRatingsCron(): boolean {
  return scheduleCron(
    "community-ratings-cron",
    RATINGS_AGGREGATE_SCHEDULE,
    async () => {
      // Brackets first: neither rollup reads them, but both pages' splits do,
      // and refreshing them in the same tick keeps all of it consistent.
      await refreshVoterBrackets();
      const tanks = await refreshTankRatingAggregates();
      const maps = await refreshMapRatingAggregates();
      console.log(
        `[community-ratings-cron] rolled up ${tanks} vehicles and ${maps} maps`,
      );
    },
  );
}
