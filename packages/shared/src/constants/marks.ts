/**
 * Which column a Marks of Excellence board is ranked by: the total across every
 * tier, or one tier of it.
 *
 * Not an enum, which is the convention everywhere else on this project, and the
 * reason is the same one that keeps the API's `language` parameter open: the
 * set is not ours to publish. It is one value plus one per tier the game has,
 * and Wargaming adds a tier when it feels like it (XI arrived with the skill
 * trees). Writing the members out would be a copy of the tier list that goes
 * stale silently, since a board ranked by a tier the enum has never heard of
 * simply falls back to the total and says nothing.
 *
 * So a sort is parsed rather than looked up, and WHICH tiers a board actually
 * draws comes from the rows themselves (the endpoint answers with the tiers
 * that have a holder), exactly as the vehicle catalogue derives its tier chips
 * from the vehicles rather than from a constant.
 */
export const MARKS_SORT_TOTAL = "total";

/** The ranking column for one tier, as it travels on the wire. */
export function marksSortForTier(tier: number): string {
  return `tier-${tier}`;
}

/**
 * The tier a sort names, or null for the total.
 *
 * Answers `undefined` for anything that is neither, so a caller can tell "rank
 * by the whole garage" from "I do not understand this" and fall back rather
 * than silently ranking by something else.
 */
export function parseMarksSort(value: string): number | null | undefined {
  if (value === MARKS_SORT_TOTAL) return null;
  const match = /^tier-(\d{1,2})$/.exec(value);
  if (!match) return undefined;
  const tier = Number(match[1]);
  return tier >= 1 ? tier : undefined;
}

export function isMarksSort(value: string): boolean {
  return parseMarksSort(value) !== undefined;
}

export const DEFAULT_MARKS_SORT = MARKS_SORT_TOTAL;

/**
 * The lowest tier a gun can carry a Mark of Excellence on.
 *
 * Wargaming awards them from tier V up, so a mark below it did not happen and
 * is a value we should never have stored. It is enforced rather than assumed
 * because the WoT portal hands its vehicle rows over POSITIONALLY and its
 * column order moves between responses, which is how battle counts once ended
 * up stored as marks. The existing guard only rejects a value outside 0 to 3,
 * so a vehicle with one, two or three battles sails straight through it with
 * its battle count sitting in the marks column.
 *
 * Measured on EU over 2,000 accounts: of 101 "marked" guns below tier V, 86
 * carried a mark exactly equal to their battle count and 93 had three battles
 * or fewer, while not one had more than ten. Tier V, by contrast, had 3,335 of
 * its 3,360 marked guns over ten battles. The floor is the game's rule and the
 * data agrees with it to the row.
 */
export const MIN_MARKS_TIER = 5;

/**
 * Battles an account needs before it is ranked here.
 *
 * Not a quality bar: the marks are the quality bar, and a three-mark gun is
 * already proof of the only thing this board claims. It exists because the
 * portal's garage reading is per account rather than per gun, so a brand new
 * account that bought a tier II and marked it in forty battles would otherwise
 * sit on the same board as a decade of play. Deliberately far below the
 * leaderboards' own floors (10,000 for the by-language board, 20,000 overall),
 * since those rank a career average and this ranks a count of achievements.
 */
export const MARKS_MIN_BATTLES = 1000;
