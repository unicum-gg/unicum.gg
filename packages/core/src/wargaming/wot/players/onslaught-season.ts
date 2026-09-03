import type { Comp7Season, Comp7Taxonomy } from "@unicum.gg/wargaming";

/** The fields of a stored season this resolution needs. */
export type StoredSeason = {
  eventId: string;
  startDate: Date | null;
  yearId: string | null;
};

/**
 * Which of the year's seasons is the live one.
 *
 * Onslaught runs as years of three seasons, and the season's name and rank art
 * are keyed by its position in the year ("first" / "second" / "third"), never by
 * a date. The client is the only place those names exist, and it publishes ALL
 * THREE from the year's first day: on the opening day of the Phoenix year it
 * already named the Azure, Crimson and Jade seasons. So "the last season the
 * client lists" is the year's last season, not the live one.
 *
 * Reading it that way is not a cosmetic bug. The name is frozen onto the season
 * the first time it is stamped, and the ordinal picks the rank art, so a season
 * would carry another season's identity permanently, and the mistake would only
 * become obvious three seasons later.
 *
 * What the client does say without ambiguity is which YEAR is running
 * (`COMP7_MASKOT_ID`, incremented once per year). So the live season's position
 * is a count of the seasons of that year we have already recorded, taken from
 * our own archive: none yet means the year's first season. That holds as long as
 * a season is stamped with its year while it is live, which is what
 * `reconcileOnslaught` does on every pass, and it degrades honestly if it does
 * not: an unrecognised count falls back to the year's last season rather than
 * inventing one.
 *
 * Returns null when the year cannot be read, and null must not be stamped: a
 * missing name can be filled in later, a wrong one cannot, since by then the
 * localization it would be re-derived from has moved to the next year.
 */
export function resolveLiveSeason(
  taxonomy: Comp7Taxonomy | null,
  stored: StoredSeason[],
  current: StoredSeason,
): Comp7Season | null {
  if (!taxonomy || taxonomy.yearId == null || taxonomy.seasons.length === 0) {
    return null;
  }
  // Without the live season's own start date there is nothing to count against,
  // and the count would come out at zero, which reads as "the year's first
  // season" and is precisely the wrong thing to guess. The source does publish
  // undated events (it happens on the tournament side too), so this is a state
  // to decline rather than an impossibility.
  if (current.startDate == null) return null;
  const startedAt = current.startDate.getTime();
  const played = stored.filter(
    (s) =>
      s.eventId !== current.eventId &&
      s.yearId === taxonomy.yearId &&
      s.startDate != null &&
      s.startDate.getTime() < startedAt,
  ).length;
  // A count past the year's length means we missed something (a season nobody
  // recorded, or a year that grew past three). Declining is the only honest
  // answer left: the name is frozen on first stamp, so naming it after the
  // year's last season would freeze one season's identity onto another, which
  // is the exact failure this file exists to prevent. Unstamped, a later pass
  // can still get it right.
  return taxonomy.seasons[played] ?? null;
}
