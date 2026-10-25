import { StrongholdPeriod } from "./stronghold";

/**
 * Primary rating metric the user wants surfaced across the site. Stored in
 * a cookie via `STORAGE.COOKIES.RATING` and broadcast to every consumer
 * through `useCookie`. WNX is the default (it is unicum.gg's signature
 * metric); users can switch to WN8, WN7 or one of Wargaming's own two from
 * the navbar.
 *
 * The five are not the same kind of number, and that is the one thing to know
 * before reading any of them. The three WN ratings are OURS: computed from
 * per-vehicle records against expected values, so they exist per vehicle and
 * over any window two snapshots bound. PR and WTR are Wargaming's: an account
 * figure the API hands over finished, with no per-vehicle value and no
 * meaning over a window (the difference between two readings of a career
 * figure is not a rating of the battles in between). So every surface that
 * rates a vehicle or a window reads `wnRatingMetric(metric)` instead, which
 * keeps the reader's WN choice and falls back to WNX for the other two.
 */
export enum RatingMetric {
  Wn7 = "wn7",
  Wn8 = "wn8",
  Wnx = "wnx",
  /** Personal Rating, `global_rating` on `account/info`. */
  Pr = "pr",
  /** World of Tanks Rating, `account/wtr`, which replaced PR in the client in 1.21. */
  Wtr = "wtr",
}

export const RATING_METRICS: RatingMetric[] = [
  RatingMetric.Wn7,
  RatingMetric.Wn8,
  RatingMetric.Wnx,
  RatingMetric.Pr,
  RatingMetric.Wtr,
];

/** The metrics that exist per vehicle and over a window, see `RatingMetric`. */
export type WnRatingMetric =
  | RatingMetric.Wn7
  | RatingMetric.Wn8
  | RatingMetric.Wnx;

export const WN_RATING_METRICS: WnRatingMetric[] = [
  RatingMetric.Wn7,
  RatingMetric.Wn8,
  RatingMetric.Wnx,
];

/** What a surface with no account-level figure shows when the reader picked
 * PR or WTR: WNX, the site's own default. */
export const WN_FALLBACK_METRIC: WnRatingMetric = RatingMetric.Wnx;

export function isWnRatingMetric(value: string): value is WnRatingMetric {
  return (WN_RATING_METRICS as readonly string[]).includes(value);
}

/** The metric a per-vehicle or per-window surface ranks by. */
export function wnRatingMetric(metric: RatingMetric): WnRatingMetric {
  return isWnRatingMetric(metric) ? metric : WN_FALLBACK_METRIC;
}

export const RATING_METRIC_LABEL: Record<RatingMetric, string> = {
  [RatingMetric.Wn7]: "WN7",
  [RatingMetric.Wn8]: "WN8",
  [RatingMetric.Wnx]: "WNX",
  [RatingMetric.Pr]: "PR",
  [RatingMetric.Wtr]: "WTR",
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
 * `TierFloor`. Every recent floor is twenty battles a day over its window,
 * the same figures they had while every tier counted: a recent board is a
 * statement about someone who plays, and a lower floor (150 for the month was
 * tried) let a casual month rank beside a full one.
 */
export const TOP_PLAYERS_MIN_BATTLES: Record<StrongholdPeriod, number> = {
  [StrongholdPeriod.Day]: 20,
  [StrongholdPeriod.Week]: 140,
  [StrongholdPeriod.Month]: 600,
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
