import { quantile } from "../lib/stats";

/**
 * What reaching Legend would take, from where a player stands right now.
 *
 * Legend is a POSITION rather than a score. The game hands the rank to the top
 * slice of the ranked field (15% of it on all three regions as this is
 * written, read off the board here rather than assumed), so its points bar
 * climbs for as long as the field keeps filling up: EU's season opened at 2312
 * and passed 3386 three weeks later. A forecast measured against today's bar is
 * therefore not a slow answer to the question, it is an answer to a different
 * one, and it flatters the player by exactly the distance the bar moves while
 * they play.
 *
 * Nothing here reads a clock, a database or a locale: the caller passes the
 * board's own curve and the two numbers the reader typed.
 */

/** One sample of a season's own cutoff curve, from the board snapshots. */
export type OnslaughtCutoffSample = {
  /** Unix seconds. */
  t: number;
  /** The points held at the last Legend position when the pass recorded it. */
  legendPoints: number | null;
};

/**
 * The season's bar as a curve, fitted as `base + growth * sqrt(days)`.
 *
 * The shape is measured, not chosen. Forecasting the EU bar a week ahead out of
 * sample costs 31 points with this fit and 236 with a straight line through the
 * trailing week, because the climb decelerates hard: the bar gained 100 points
 * a day in the season's first week and 19 in its third, so a line fitted on any
 * window overshoots, by 842 points at a fortnight's range. A square root was
 * the best of six candidates on all three regions at every horizon tested, and
 * is the shape a filling board produces: the field that decides the cutoff
 * grows fast while it fills and then barely at all.
 *
 * Two parameters rather than anything richer on purpose. Asia's board holds 168
 * players and its bar FALLS on a bad evening (a Legend dropping off moves the
 * 15% position down), so a model with room to chase that noise would forecast
 * it.
 */
export type OnslaughtCutoffCurve = {
  base: number;
  growth: number;
  /** Unix seconds of the first sample: the curve's own day zero. */
  start: number;
  /** Unix seconds of the newest sample. This is the forecast's "now": the page
   * is prerendered and hydrated, so a clock read during a render disagrees with
   * itself across that boundary, and the board's last capture is both stable
   * and the instant its figures are true at. */
  at: number;
  /** The bar at `at`, observed rather than fitted. Projections are anchored on
   * it, so the panel cannot contradict the number the board is showing. */
  points: number;
  /** Days of curve the fit had to work with. */
  observedDays: number;
};

const DAY_SECONDS = 86_400;

export function fitCutoffCurve(
  samples: OnslaughtCutoffSample[],
): OnslaughtCutoffCurve | null {
  const usable = samples.filter(
    (s): s is { t: number; legendPoints: number } => s.legendPoints != null,
  );
  const first = usable[0];
  const last = usable.at(-1);
  if (!first || !last) return null;

  const xs = usable.map((s) => Math.sqrt((s.t - first.t) / DAY_SECONDS));
  const ys = usable.map((s) => s.legendPoints);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < xs.length; i++) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY);
    variance += (xs[i] - meanX) ** 2;
  }
  const growth = variance > 0 ? covariance / variance : 0;

  return {
    growth,
    base: meanY - growth * meanX,
    start: first.t,
    at: last.t,
    points: last.legendPoints,
    observedDays: (last.t - first.t) / DAY_SECONDS,
  };
}

/**
 * The bar at an instant, anchored on the last one actually observed.
 *
 * The fit's own value at "now" is a few tens of points off the bar the board is
 * showing, and publishing that gap would make the panel argue with the table
 * above it. So what is projected is the DISTANCE the curve travels from here,
 * added to the figure the reader can see.
 */
export function projectCutoff(
  curve: OnslaughtCutoffCurve,
  atSeconds: number,
): number {
  const days = (at: number) => Math.max(0, (at - curve.start) / DAY_SECONDS);
  const fitted = (at: number) => curve.base + curve.growth * Math.sqrt(days(at));
  return curve.points + (fitted(atSeconds) - fitted(curve.at));
}

/**
 * What a battle has actually been worth to a player, from the two numbers they
 * gave.
 *
 * The trap this exists to avoid: dividing the points they hold by the battles
 * they played answers 6.0 on the current EU board, where the players on it are
 * gaining 2.4 (measured over 320,000 battles of the season's own captures).
 * The gap is not noise, it is that the climb TO the leaderboard is a different
 * game from the one played on it. Reaching the entry bar costs a median 139
 * battles at around 14 points each, and every battle after that is worth a
 * fifth of one. A forecast built on the naive figure understates the grind by a
 * factor of two and a half, which on this board is the difference between a
 * fortnight and a season nobody has time for.
 *
 * So the qualifying leg is taken off before the division: the battles the
 * board's own players needed to arrive (its median, passed in) off the battles,
 * and the entry bar off the points. What is left is the rate they have held ON
 * the board, which is the only one that forecasts anything.
 *
 * It is the best of five estimators tried, checked against the 964 EU players
 * whose real rate the season's captures can be differenced out of: this one is
 * unbiased (median error 0.01 points a battle) and lands within a factor of two
 * of the truth for 77% of them, at a median absolute error of 0.44. Matching a
 * player against the board's own players by rating, which sounds better and is
 * the fallback below, manages 57% and twice the error, because two players on
 * the same rating got there at wildly different speeds. The naive division is
 * the one to beat and it is not close: it overstates the typical player by 2.3
 * times and lands within a factor of two for barely a third of them.
 *
 * Null when too little is left of that division to mean anything, which happens
 * to a player who qualified far faster than the median and to one who has just
 * arrived. The board's own rate for their neighbourhood is then a better answer
 * than a number computed from noise, and the caller has it.
 */
export function boardRateOf({
  battles,
  points,
  entryBar,
  entryBattles,
  minBattles = 25,
}: {
  battles: number;
  points: number;
  /** Rating at which a player enters the board (2000 on every region today). */
  entryBar: number;
  /** What qualifying cost the board's own players, as a median. */
  entryBattles: number;
  /** Below this many battles on the board, the division is noise. */
  minBattles?: number;
}): number | null {
  if (points < entryBar) return null;
  const onBoard = battles - entryBattles;
  if (onBoard < minBattles) return null;
  const rate = (points - entryBar) / onBoard;
  return rate > 0 ? rate : null;
}

/** How a player's season ends, measured against the step they are climbing to. */
export enum ClimbOutlook {
  /** Over the bar already, with the season's climb still to survive. */
  Held = "held",
  /** The board's own players are playing at least this much. */
  Reachable = "reachable",
  /** More than all but the hardest quarter of the board is playing. */
  Demanding = "demanding",
  /** More than anyone on the board is playing. */
  OutOfReach = "out-of-reach",
}

export type ClimbPlan = {
  outlook: ClimbOutlook;
  /** The bar they have to be over when the season settles. */
  target: number;
  /** Points between them and it. Negative when they are already past it. */
  gap: number;
  /** Battles to cover the gap, qualifying leg included. */
  battles: number;
  /** Those battles spread over the days the season has left. */
  battlesPerDay: number;
  /** Of those battles, the ones spent reaching the board's entry bar, which are
   * worth several times more each and are a different fight. */
  qualifyingBattles: number;
  /** Days of season left, from the board's last capture. */
  daysLeft: number;
};

/**
 * What it takes to be holding a given number of points when the season settles.
 *
 * One step of the ladder at a time, which is what the ranks are: a fixed number
 * for everything up to Champion (the divisions are a hundred points apart and
 * the board's floor is 2000), and for Legend the bar projected to the last day,
 * since that one climbs all season and is a position rather than a score.
 *
 * The deadline is the whole question, and it is why this answers in a pace
 * rather than in a total: the rank is decided by where a player stands when it
 * ends, so a thousand battles are worth nothing in two days and three hundred
 * are enough in three weeks.
 *
 * Two legs, because a player under the entry bar is playing a different game:
 * they cover the distance to it at their own current rate, which is honest
 * since it is the phase they are in, and everything past it at the board rate.
 */
export function climbTo({
  points,
  target,
  entryBar,
  rate,
  qualifyingRate,
  daysLeft,
  paces,
}: {
  points: number;
  /** The points the step costs: a division's floor, Champion's 2000, or the
   * Legend bar projected to the season's end by `projectCutoff`. */
  target: number;
  entryBar: number;
  /** Points a battle on the board. */
  rate: number;
  /** Points a battle below the entry bar, where the climb is faster. */
  qualifyingRate: number;
  daysLeft: number;
  /** What the board's own players are playing a day, for the verdict. Sorted
   * ascending, typically its quartiles. */
  paces: number[];
}): ClimbPlan | null {
  if (rate <= 0 || qualifyingRate <= 0 || daysLeft <= 0) return null;

  // The qualifying leg stops at whichever comes first, the entry bar or the
  // step being asked about. Run to the bar unconditionally, as this did at
  // first, and every rank BELOW the leaderboard is priced at the cost of
  // reaching the leaderboard: Silver B, Gold E and Champion all came back at
  // the same 129 battles for a player sitting on 1240 points.
  const qualifyingTarget = Math.min(target, entryBar);
  const qualifyingBattles =
    points < qualifyingTarget ? (qualifyingTarget - points) / qualifyingRate : 0;
  const onBoard =
    target > entryBar
      ? Math.max(0, (target - Math.max(points, entryBar)) / rate)
      : 0;
  const battles = qualifyingBattles + onBoard;
  const battlesPerDay = battles / daysLeft;
  const hardest = paces.at(-1) ?? Number.POSITIVE_INFINITY;
  const typical = paces.length > 0 ? paces[Math.floor(paces.length / 2)] : 0;

  return {
    outlook:
      points >= target
        ? ClimbOutlook.Held
        : battlesPerDay > hardest
          ? ClimbOutlook.OutOfReach
          : battlesPerDay > typical
            ? ClimbOutlook.Demanding
            : ClimbOutlook.Reachable,
    target,
    gap: target - points,
    battles,
    battlesPerDay,
    qualifyingBattles,
    daysLeft,
  };
}

/**
 * Where a player's points land after a given number of battles.
 *
 * Two legs, because the mode is two different games either side of the
 * leaderboard's floor: every battle under it is worth several times one over
 * it (fourteen points against two and a half, measured on the current EU
 * season), so a player climbing towards Champion covers the remaining distance
 * fast and then slows down the moment they arrive. A single average across both
 * would overstate everything that happens after.
 */
export function pointsAfter({
  points,
  entryBar,
  rate,
  qualifyingRate,
  battles,
}: {
  points: number;
  entryBar: number;
  /** Points a battle on the board. */
  rate: number;
  /** Points a battle below the entry bar. */
  qualifyingRate: number;
  battles: number;
}): number {
  const qualifying =
    points < entryBar && qualifyingRate > 0
      ? (entryBar - points) / qualifyingRate
      : 0;
  return battles <= qualifying
    ? points + qualifyingRate * battles
    : Math.max(points, entryBar) + rate * (battles - qualifying);
}

/**
 * How the race actually runs, at a pace the player picks.
 *
 * The plan above answers the deadline and this answers the schedule, and they
 * are not the same question: a reader who is not going to change how much they
 * play needs to know what that gets them, which is a date, sometimes a date
 * after the season is settled, and sometimes no date at all.
 *
 * It reports BOTH transitions, because a player over the bar today is not safe.
 * The bar keeps climbing whether or not they play, so a margin is a countdown,
 * and someone whose pace gains less than the bar does will be passed by it: the
 * season's own captures are full of players who held a place in week two and
 * not in week four. A function that only looked for the crossing from below
 * would have told them they were already there and stopped.
 *
 * Walked rather than solved, because the bar is a curve and the player is a
 * line through two phases, so the difference between them can narrow before it
 * widens. A quarter-day step over a bounded horizon, which is a few thousand
 * additions and is finer than a board that moves every five minutes.
 */
export type LegendRace = {
  /** Days until their points first clear the bar, null if never within the
   * horizon. */
  crossesAt: number | null;
  /** Battles that takes. */
  battles: number | null;
  /** Days until the bar takes the place back, null while it does not. */
  fallsAt: number | null;
  /** Where they stand when the season settles, which is the only instant that
   * hands out the rank. */
  legendAtEnd: boolean;
};

export function raceToLegend({
  points,
  entryBar,
  rate,
  qualifyingRate,
  battlesPerDay,
  curve,
  daysLeft,
  horizonDays = 180,
}: {
  points: number;
  entryBar: number;
  rate: number;
  qualifyingRate: number;
  battlesPerDay: number;
  curve: OnslaughtCutoffCurve;
  /** Days of season left, the instant `legendAtEnd` is read at. */
  daysLeft: number | null;
  horizonDays?: number;
}): LegendRace {
  const idle: LegendRace = {
    crossesAt: null,
    battles: null,
    fallsAt: null,
    legendAtEnd: false,
  };
  if (rate <= 0 || qualifyingRate <= 0 || battlesPerDay <= 0) return idle;

  const pointsAt = (battles: number) =>
    pointsAfter({ points, entryBar, rate, qualifyingRate, battles });
  const barAt = (days: number) =>
    projectCutoff(curve, curve.at + days * DAY_SECONDS);

  const step = 0.25;
  const horizon = Math.max(horizonDays, (daysLeft ?? 0) + step);
  const race: LegendRace = { ...idle };
  let previous: number | null = null;
  for (let days = 0; days <= horizon; days += step) {
    const ahead = pointsAt(days * battlesPerDay) - barAt(days);
    if (ahead >= 0 && race.crossesAt == null) {
      const at =
        previous == null || previous >= 0
          ? days
          : days - step + (step * -previous) / (ahead - previous);
      race.crossesAt = at;
      race.battles = at * battlesPerDay;
    } else if (ahead < 0 && race.crossesAt != null && race.fallsAt == null) {
      race.fallsAt = days;
    }
    previous = ahead;
  }
  // Read where the settling day actually falls rather than at whichever step is
  // nearer it, since that one instant is what hands out the rank.
  race.legendAtEnd =
    daysLeft == null
      ? race.crossesAt != null
      : pointsAt(daysLeft * battlesPerDay) >= barAt(daysLeft);
  return race;
}

/**
 * The paces the board itself plays at, as battles a day of SEASON.
 *
 * Three scenarios read off the ranked field rather than three round numbers
 * chosen here, so they stay true per region and per season. Counted over every
 * day the season has run rather than over the days a player was seen playing,
 * because that is the denominator a forecast against a deadline needs, and it
 * is the same one the tier profile publishes beside this: naming two different
 * denominators "battles per day" on one page is how a reader ends up thinking
 * two panels contradict each other.
 */
export function boardPaces(battlesPerSeasonDay: number[]): number[] {
  const sorted = battlesPerSeasonDay.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const paces = [0.25, 0.5, 0.75].map((q) =>
    Math.max(1, Math.round(quantile(sorted, q))),
  );
  return [...new Set(paces)];
}
