import {
  MAP_DETAIL_AXES,
  starDistribution,
  VOTER_BRACKETS,
  type MapRatingSummary,
} from "@unicum.gg/shared";

/**
 * A verdict with nothing in it, for the last-resort net under the page render.
 *
 * `buildSafe` prerenders an empty shell when even the in-process handler cannot
 * answer (a DB-less build environment), and the page heals on its first
 * revalidation. The panel is built to render the no-votes state, so this is a
 * real shape rather than a null: the alternative is a panel full of optional
 * chains for a case that resolves itself within an hour.
 *
 * Built from the same helpers the endpoint uses rather than typed out, so a bar
 * or a bracket added to the scale appears here too instead of leaving an empty
 * histogram one step short.
 */
export const EMPTY_MAP_RATING_SUMMARY: MapRatingSummary = {
  arenaId: "",
  votes: 0,
  overall: null,
  fun: null,
  overallBayes: null,
  funBayes: null,
  overallStddev: null,
  consensus: null,
  overallDistribution: starDistribution({}),
  funDistribution: starDistribution({}),
  brackets: VOTER_BRACKETS.map((bracket) => ({
    bracket,
    votes: 0,
    overall: null,
    fun: null,
    avgBattles: null,
  })),
  regions: [],
  axes: MAP_DETAIL_AXES.map((axis) => ({ axis, value: null, votes: 0 })),
  axisVotes: 0,
  avgVoterRecentBattles: null,
  reviews: [],
  reviewCount: 0,
};
