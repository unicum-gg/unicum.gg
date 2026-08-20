import type { TankIdentityRow } from "@/app/api/[region]/tanks/identity.api";

/**
 * One line of the community board.
 *
 * Flat rather than `{ identity, rating }`, so it satisfies `FilterableTank` and
 * the catalogue's own filter bar works on it untouched. The alternative was a
 * second filter implementation over a nested shape, which is how a site ends up
 * with two ways to narrow a list of tanks that behave almost the same.
 */
export type CommunityBoardRow = TankIdentityRow & {
  votes: number;
  reviews: number;
  /** The plain means, which is what a five-star average means to a reader. */
  overall: number | null;
  fun: number | null;
  /** The shrunk means, which is what the columns are ranked on. Held beside the
   * plain ones rather than replacing them: the number shown and the number
   * sorted on are different on purpose, and hiding that would make the order
   * look wrong. */
  overallBayes: number | null;
  funBayes: number | null;
  overallStddev: number | null;
  perceivedPercentile: number | null;
  measuredPercentile: number | null;
  hype: number | null;
};
