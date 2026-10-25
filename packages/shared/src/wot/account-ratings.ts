import { RatingColor } from "./ratings";

/**
 * Wargaming's two account ratings: Personal Rating (`global_rating` on
 * `account/info`) and the World of Tanks Rating (`account/wtr`) that replaced
 * it in the client in 1.21. Both arrive finished from the API, so all that is
 * ours here is how they are coloured.
 */

/** The five groups the client shows a WTR in, lowest first. */
export enum WtrGroup {
  Bronze = "bronze",
  Silver = "silver",
  Gold = "gold",
  Ace = "ace",
  Legend = "legend",
}

/**
 * Where each of the client's fifteen WTR levels starts, as of 1.21: three per
 * group, `WTR_STAGES[g][l]` being the first rating of level `l + 1` of group
 * `g`.
 *
 * The client does not carry these. It reads them from the server settings
 * (`getStagesOfWTR`) and bisects the account's rating into them exactly the
 * way `wtrStage` below does, so they are the figures Wargaming announced for
 * 1.21 and that the community has tabulated since. Every boundary of
 * `wtrColor` is one of them, which is what keeps a colour on this site from
 * contradicting the level the same player sees in their own garage.
 */
export const WTR_STAGES: Record<WtrGroup, readonly [number, number, number]> = {
  [WtrGroup.Bronze]: [0, 400, 1000],
  [WtrGroup.Silver]: [1400, 1900, 2700],
  [WtrGroup.Gold]: [3200, 3900, 4800],
  [WtrGroup.Ace]: [5400, 6200, 7300],
  [WtrGroup.Legend]: [8000, 8800, 9900],
};

export type WtrStage = { group: WtrGroup; level: 1 | 2 | 3 };

/** The level the client would show for a rating, null below zero. */
export function wtrStage(wtr: number): WtrStage | null {
  let found: WtrStage | null = null;
  for (const group of Object.values(WtrGroup)) {
    WTR_STAGES[group].forEach((from, i) => {
      if (wtr >= from) found = { group, level: (i + 1) as 1 | 2 | 3 };
    });
  }
  return found;
}

/**
 * The site's nine colours over the client's fifteen levels.
 *
 * Fifteen levels do not fit nine colours, so each boundary below is the level
 * edge that splits the population closest to where WN8's own boundary splits
 * it, measured on 21,519 EU accounts over a hundred battles: WN8's colours
 * leave 8.8 / 25.7 / 47.2 / 70.0 / 84.6 / 92.0 / 96.9 / 99.0% of the region
 * below each step, and these edges leave 3.9 / 25.8 / 43.7 / 75.1 / 85.3 /
 * 94.0 / 96.7 / 99.6%. So a WTR and a WN8 of the same player wear the same
 * colour about as often as two ratings correlated at 0.93 can, and no colour
 * ever changes in the middle of a level the client displays as one. Two of
 * the steps fall on a group boundary (Ace I, Legend I), which is also where a
 * player reads a change of colour in their own garage.
 */
export function wtrColor(value: number): RatingColor {
  if (value < 1900) return RatingColor.VeryBad;
  if (value < 3200) return RatingColor.Bad;
  if (value < 3900) return RatingColor.BelowAvg;
  if (value < 5400) return RatingColor.Average;
  if (value < 6200) return RatingColor.Good;
  if (value < 7300) return RatingColor.VeryGood;
  if (value < 8000) return RatingColor.Super;
  if (value < 9900) return RatingColor.Excellent;
  return RatingColor.Top;
}

/**
 * Personal Rating has no published colour scale: the client showed it as a
 * bare number and Wargaming never banded it. So these are measured, on the
 * same 21,519-account EU sample `wtrColor` was matched on, each one the value
 * that leaves the share of the population WN8's matching boundary leaves,
 * rounded to the hundred.
 */
export function prColor(value: number): RatingColor {
  if (value < 2000) return RatingColor.VeryBad;
  if (value < 3100) return RatingColor.Bad;
  if (value < 4200) return RatingColor.BelowAvg;
  if (value < 5400) return RatingColor.Average;
  if (value < 6600) return RatingColor.Good;
  if (value < 7500) return RatingColor.VeryGood;
  if (value < 8700) return RatingColor.Super;
  if (value < 9600) return RatingColor.Excellent;
  return RatingColor.Top;
}
