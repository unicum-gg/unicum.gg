import { MIN_MARKS_TIER } from "../constants/marks";

/**
 * How many Marks of Excellence a garage holds, by level and by tier.
 *
 * Pure, and deliberately NOT folded into `buildPlayerMarkProgress` beside it,
 * which answers the profile panel's question from the whole garage (it needs
 * the vehicles carrying NO mark, the mastery badges and the reach list, none of
 * which a count of marks can supply). This one takes only what the portal hands
 * over, a mark level per vehicle, so it is the fold both the refresh path and
 * the one-off backfill can run: neither of them holds a garage row.
 */

/** The highest mark a gun can carry. */
export const MAX_MARKS = 3;

/** A mark level, as the portal reports it: 0 for an unmarked gun. */
export type MarkLevel = 0 | 1 | 2 | 3;

/** One level's tally: the per-tier array plus its own sum. */
export type MarkLevelCounts = {
  /**
   * Vehicles at this level, by tier, with index `i` holding tier `i + 1`.
   *
   * Trailing zeroes are trimmed, so the array is as long as the highest tier
   * the player actually has a mark at and a tier Wargaming adds later simply
   * makes it one longer. Read it with `markCountAtTier`, never by index.
   */
  byTier: number[];
  total: number;
};

export type PlayerMarkCounts = {
  mark1: MarkLevelCounts;
  mark2: MarkLevelCounts;
  mark3: MarkLevelCounts;
  /**
   * Vehicles that COULD carry a mark and whose level we read, which is the
   * count's own denominator. It separates a player with no marks from a garage
   * we have only partly read, and it is zero for an account whose marks have
   * never been fetched. Vehicles below `MIN_MARKS_TIER` are not in it: the game
   * puts no mark on them, so they are not a garage we failed to read, they are
   * outside what is being counted.
   */
  known: number;
};

/** Zero of every level, for a garage with nothing in it. */
export function emptyMarkCounts(): PlayerMarkCounts {
  return {
    mark1: { byTier: [], total: 0 },
    mark2: { byTier: [], total: 0 },
    mark3: { byTier: [], total: 0 },
    known: 0,
  };
}

/**
 * Read one tier out of a stored tally.
 *
 * Out of range answers 0 rather than undefined: a tier nobody has a mark at and
 * a tier past the end of the array are the same answer, and a caller that had
 * to tell them apart would have to know how long the array is.
 */
export function markCountAtTier(byTier: number[], tier: number): number {
  if (!Number.isInteger(tier) || tier < 1) return 0;
  return byTier[tier - 1] ?? 0;
}

/** Sum a stored tally over a set of tiers, for a column grouping several. */
export function markCountOverTiers(byTier: number[], tiers: number[]): number {
  return tiers.reduce((sum, tier) => sum + markCountAtTier(byTier, tier), 0);
}

/**
 * Fold a per-vehicle mark level into the stored shape.
 *
 * `tierOf` answers null for a vehicle the catalogue does not place, which is
 * left out of every tally INCLUDING `known`: a mark we cannot file under a tier
 * would make the total disagree with the sum of the columns under it, and the
 * per-tier split is the whole subject of the board this feeds. In practice that
 * is a vehicle the encyclopedia has not published yet, which the next refresh
 * picks up.
 *
 * A level outside 0 to 3 is dropped rather than clamped, matching
 * `fetchPlayerMarksOnGun`: the portal's rows are positional and its column
 * order moves between responses, so a value off the scale means we are reading
 * a different column than we think, not that the gun has four marks.
 *
 * So is a mark below `MIN_MARKS_TIER`, which is the same failure wearing a
 * value the scale happens to allow: the game puts no mark on a tier IV, so a
 * three there is a battle count that landed in the marks column. Enforced here
 * as well as at the portal because this also folds rows stored before that
 * guard knew about tiers.
 */
export function buildPlayerMarkCounts(
  marksByTank: Iterable<readonly [number, number]>,
  tierOf: (tankId: number) => number | null,
): PlayerMarkCounts {
  const counts = emptyMarkCounts();
  const levels: MarkLevelCounts[] = [counts.mark1, counts.mark2, counts.mark3];

  for (const [tankId, marks] of marksByTank) {
    if (!Number.isInteger(marks) || marks < 0 || marks > MAX_MARKS) continue;
    const tier = tierOf(tankId);
    if (tier == null || !Number.isInteger(tier) || tier < MIN_MARKS_TIER) {
      continue;
    }
    counts.known += 1;
    if (marks === 0) continue;
    const level = levels[marks - 1];
    level.total += 1;
    while (level.byTier.length < tier) level.byTier.push(0);
    level.byTier[tier - 1] += 1;
  }

  return counts;
}
