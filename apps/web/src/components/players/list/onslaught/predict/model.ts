import {
  boardPaces,
  fitCutoffCurve,
  median,
  ONSLAUGHT_DIVISIONS,
  onslaughtLadder,
  OnslaughtRank,
  type OnslaughtCutoffCurve,
  type OnslaughtStanding,
  projectCutoff,
} from "@unicum.gg/shared";
import type { OnslaughtRow } from "@/components/players/list/onslaught/row";
import type { OnslaughtSeasonPoint } from "@/components/players/list/onslaught/season-race";

const DAY_SECONDS = 86_400;

/**
 * Everything the prediction needs that the reader does not type, read off the
 * board the page already loaded.
 *
 * Not one figure here is a constant written into the code, and that is the
 * point: what qualifying costs, what a battle is worth and how hard the field
 * plays all differ by region and by season (NA's Legend bar sits at 4190 on a
 * board of 163 players while EU's is at 3386 on 1465), so a number chosen here
 * would be wrong for two regions out of three the day it was written and for
 * all three a season later. The one exception is the rank ladder itself, which
 * is the game's own scale and the same everywhere.
 */
export type PredictModel = {
  /** The rating a player enters the board at, which is Champion's threshold. */
  entryBar: number;
  /** Battles the board's own players had played when they first appeared on
   * it, as a median: the price of qualifying. */
  entryBattles: number;
  /** Points a battle below the entry bar, where the climb is several times
   * faster than it is on the board. Derived from the price above rather than
   * measured directly, since nobody under the bar is on the board to measure. */
  qualifyingRate: number;
  /** What the ranked field plays in a day of season, as quartiles. */
  paces: number[];
  curve: OnslaughtCutoffCurve | null;
  /** Days the season had run at the board's last capture. */
  seasonDays: number | null;
  /** Days it has left from that same instant. */
  daysLeft: number | null;
  /** The Legend bar projected to the day the season settles, which is the only
   * bar that decides that rank. Null when we cannot project one, and then the
   * ladder simply stops at Champion. */
  legendTarget: number | null;
  /** The bar right now, as the board last published it. */
  legendNow: number | null;
};

export function buildPredictModel({
  results,
  curve,
  seasonStart,
  seasonEnd,
}: {
  results: OnslaughtRow[];
  curve: OnslaughtSeasonPoint[] | null;
  seasonStart: string | null;
  seasonEnd: string | null;
}): PredictModel {
  const fitted = curve ? fitCutoffCurve(curve) : null;
  const at = fitted?.at ?? null;

  const ratings = results.map((r) => r.rating).filter((v) => v > 0);
  const entryBar = ratings.length > 0 ? Math.min(...ratings) : 2000;
  const entryBattles =
    median(
      results.map((r) => r.entryBattles).filter((v): v is number => v != null && v > 0),
    ) ?? 0;

  const startedAt = seasonStart ? Date.parse(seasonStart) / 1000 : fitted?.start;
  const seasonDays =
    at != null && startedAt != null ? Math.max(1, (at - startedAt) / DAY_SECONDS) : null;
  const endsAt = seasonEnd ? Date.parse(seasonEnd) / 1000 : null;

  return {
    entryBar,
    entryBattles,
    // A player under the bar is climbing the qualifying ladder, where a battle
    // is worth what it took the board's own players to arrive: 2000 points over
    // a median 139 battles on EU, around fourteen each, against the 2.4 the
    // same players average once they are ranked.
    qualifyingRate: entryBattles > 0 ? entryBar / entryBattles : 0,
    paces: boardPaces(
      seasonDays == null
        ? []
        : results.map((r) => r.battles / seasonDays).filter((v) => v > 0),
    ),
    curve: fitted,
    seasonDays,
    daysLeft:
      at != null && endsAt != null ? Math.max(0, (endsAt - at) / DAY_SECONDS) : null,
    legendTarget:
      fitted && endsAt != null ? projectCutoff(fitted, endsAt) : (fitted?.points ?? null),
    legendNow: fitted?.points ?? null,
  };
}

/**
 * What a battle is worth to the players sitting where this one is.
 *
 * The fallback for a reader whose own two numbers cannot answer it, which is
 * everyone still under the leaderboard and anyone who has just arrived on it.
 * Read from the neighbourhood they are in rather than from the whole board,
 * because the rate rises with the standings (1.4 points a battle at the bottom
 * of the EU board against 6.1 at the top): the board's overall median would
 * tell someone at the entry bar they are gaining twice what they are.
 *
 * It is a weak estimator and is only ever the second choice. Checked against
 * the players whose real rate we can difference out of the captures, matching
 * on rating alone lands within a factor of two for 57% of them against 77% for
 * reading a player's own record, because two players holding the same rating
 * got there at very different speeds.
 */
export function neighbourhoodRate(
  results: OnslaughtRow[],
  points: number,
): number | null {
  const rated = results.filter(
    (r): r is OnslaughtRow & { pointsPerBattle: number } =>
      r.pointsPerBattle != null && r.pointsPerBattle > 0,
  );
  for (const width of [250, 500, 1000, Number.POSITIVE_INFINITY]) {
    const near = rated.filter((r) => Math.abs(r.rating - points) <= width);
    if (near.length >= 20) return median(near.map((r) => r.pointsPerBattle));
  }
  return median(rated.map((r) => r.pointsPerBattle));
}

/**
 * The steps worth showing a player above where they stand.
 *
 * Not the whole ladder: twenty-two rows, twenty of them a hundred points apart,
 * is a scale rather than a plan. What a reader is deciding between is the
 * division they are about to reach and the RANKS beyond it, since a rank is
 * what the game names them by and what the rewards hang off, so the divisions
 * in between are shown only when the next one is the immediate next step.
 */
export function stepsAbove(
  points: number,
  legendTarget: number | null,
): OnslaughtStanding[] {
  const ladder = onslaughtLadder(legendTarget);
  const above = ladder.filter((step) => step.floor > points);
  const steps: OnslaughtStanding[] = [];
  for (const [index, step] of above.entries()) {
    // The one division kept is the very next step, which is the goal a player
    // in a divided rank is actually playing for tonight.
    const isNextStep = index === 0;
    const isRankStart =
      step.division == null || step.division === ONSLAUGHT_DIVISIONS[0];
    if (isNextStep || isRankStart) steps.push(step);
  }
  return steps;
}

/** The rank a step names, for the rows that are a division of one. */
export function isPrestige(rank: OnslaughtRank): boolean {
  return rank === OnslaughtRank.Champion || rank === OnslaughtRank.Legend;
}
