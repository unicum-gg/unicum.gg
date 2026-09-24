import { ONSLAUGHT_DIVISIONS, type OnslaughtStanding } from "@unicum.gg/shared";

/**
 * A step of the ladder as the game names it: "Gold C", "Champion".
 *
 * The rank is the game's own word in the reader's language and the division is
 * a letter the game does not translate, but their ORDER is not ours to assume,
 * so the pair is assembled from a template in the same catalogue rather than
 * concatenated here.
 */
export function standingName(
  standing: OnslaughtStanding,
  tGame: (key: string, values?: Record<string, string | number>) => string,
  options?: { rankOnly?: boolean },
): string {
  const rank = tGame(`onslaught-tiers.${standing.rank}`);
  return standing.division == null || options?.rankOnly
    ? rank
    : tGame("onslaught-tiers.division", {
        rank,
        division: standing.division,
      });
}

/** True when a step is where its rank begins, which is how the ladder decides
 * to name the row after the rank rather than after the division it opens on. */
export function opensRank(standing: OnslaughtStanding): boolean {
  return standing.division == null || standing.division === ONSLAUGHT_DIVISIONS[0];
}
