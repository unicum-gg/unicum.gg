import type { MapCamouflage } from "@unicum.gg/shared";

/**
 * One line of the map community board.
 *
 * Flat rather than `{ identity, rating }`, like the vehicle board's row and for
 * the same reason: a table sorts and filters on fields, and a nested shape
 * means every comparator has to know which half a column lives in.
 */
export type MapCommunityRow = {
  /** The arena, which is what the votes are keyed on and what the minimap's
   * fallback chain is derived from. */
  arenaId: string;
  slug: string;
  /** The catalogue's English name, which is what the slug came from. The table
   * shows Wargaming's own name in the reader's language instead, resolved from
   * the arena id, and keeps this one to break a sort tie so the order does not
   * change with the language. */
  name: string;
  camouflage: MapCamouflage;
  sizeMeters: number;
  minimapUrl: string;
  commonTest: boolean;
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
};
