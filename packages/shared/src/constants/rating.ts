import { StrongholdPeriod } from "./stronghold";

/**
 * Primary rating metric the user wants surfaced across the site. Stored in
 * a cookie via `STORAGE.COOKIES.RATING` and broadcast to every consumer
 * through `useCookie`. WNX is the default (it is unicum.gg's signature
 * metric); users can switch to the older WN8 or WN7 from the navbar.
 */
export enum RatingMetric {
  Wn7 = "wn7",
  Wn8 = "wn8",
  Wnx = "wnx",
}

export const RATING_METRICS: RatingMetric[] = [
  RatingMetric.Wn7,
  RatingMetric.Wn8,
  RatingMetric.Wnx,
];

export const RATING_METRIC_LABEL: Record<RatingMetric, string> = {
  [RatingMetric.Wn7]: "WN7",
  [RatingMetric.Wn8]: "WN8",
  [RatingMetric.Wnx]: "WNX",
};

export const DEFAULT_RATING_METRIC: RatingMetric = RatingMetric.Wnx;

export function isRatingMetric(value: string): value is RatingMetric {
  return (RATING_METRICS as readonly string[]).includes(value);
}

export function ratingMetricFromCookie(
  raw: string | null | undefined,
): RatingMetric {
  return raw && isRatingMetric(raw) ? raw : DEFAULT_RATING_METRIC;
}

/**
 * Battles a player needs inside a leaderboard's window to be ranked on it.
 *
 * Keyed by the site's four-window axis (named for the stronghold boards that
 * needed it first, see `useStatsPeriod`), whose values are the API's `period`
 * and the period cookie alike, so a client can state the floor of the board it
 * is showing without importing the server enum. The recent floors scale with
 * the window so a ranking is not won on a handful of lucky games.
 *
 * On a recent window they count only the battles at or above the board's
 * `TierFloor`. They were 140 and 600 for the week and the month while every
 * tier counted, high enough to be the only thing standing between the board and
 * a low-tier farm, and it still lost: on 2026-10-21, 19 of the 30-day WN8
 * board's top 20 on EU had averaged tier 3 to 5 over the month. With the farm
 * out of the count the floor only has to rule out luck: 75 for a week and
 * twice that for a month.
 */
export const TOP_PLAYERS_MIN_BATTLES: Record<StrongholdPeriod, number> = {
  [StrongholdPeriod.Day]: 20,
  [StrongholdPeriod.Week]: 75,
  [StrongholdPeriod.Month]: 150,
  [StrongholdPeriod.Overall]: 20000,
};

/**
 * The lowest tier whose battles a recent leaderboard counts.
 *
 * A recent board rates only the battles fought at this tier or above, ignoring
 * the rest, rather than excluding players whose AVERAGE tier is too low: an
 * average can be met by mixing a low-tier farm with enough top-tier games,
 * while a floor on the battles cannot be gamed and still ranks everybody on the
 * part of their games that qualifies. Three boards rather than one, because
 * "how well do you play tier VI and up" and "how well do you play at the top"
 * put different people first. Tier X includes XI.
 *
 * The values are the tiers themselves and travel as the API's `min_tier`.
 */
export enum TierFloor {
  Six = 6,
  Eight = 8,
  Ten = 10,
}

export const TIER_FLOORS: TierFloor[] = [TierFloor.Six, TierFloor.Eight, TierFloor.Ten];

export const DEFAULT_TIER_FLOOR: TierFloor = TierFloor.Six;

export function parseTierFloor(raw: string | number | null | undefined): TierFloor {
  const value = Number(raw);
  return TIER_FLOORS.find((floor) => floor === value) ?? DEFAULT_TIER_FLOOR;
}
