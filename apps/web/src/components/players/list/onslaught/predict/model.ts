import {
  fitCutoffCurve,
  ONSLAUGHT_DIVISIONS,
  onslaughtLadder,
  onslaughtPaces,
  OnslaughtRank,
  type OnslaughtAggregates,
  type OnslaughtCutoffCurve,
  type OnslaughtStanding,
  projectCutoff,
} from "@unicum.gg/shared";
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
  aggregates,
  curve,
  seasonStart,
  seasonEnd,
}: {
  /** The whole board's own figures, computed server-side: the model describes
   * the field, and the page only ever holds a page of it. */
  aggregates: OnslaughtAggregates;
  curve: OnslaughtSeasonPoint[] | null;
  seasonStart: string | null;
  seasonEnd: string | null;
}): PredictModel {
  const fitted = curve ? fitCutoffCurve(curve) : null;
  const at = fitted?.at ?? null;

  const startedAt = seasonStart ? Date.parse(seasonStart) / 1000 : fitted?.start;
  const seasonDays =
    at != null && startedAt != null ? Math.max(1, (at - startedAt) / DAY_SECONDS) : null;
  const endsAt = seasonEnd ? Date.parse(seasonEnd) / 1000 : null;

  return {
    entryBar: aggregates.entryBar,
    entryBattles: aggregates.entryBattles,
    // A player under the bar is climbing the qualifying ladder, where a battle
    // is worth what it took the board's own players to arrive: 2000 points over
    // a median 139 battles on EU, around fourteen each, against the 2.4 the
    // same players average once they are ranked.
    qualifyingRate:
      aggregates.entryBattles > 0 ? aggregates.entryBar / aggregates.entryBattles : 0,
    // The quartiles arrive raw because the divisor is the season's own length,
    // which is read off a curve this model may not have been given.
    paces: onslaughtPaces(aggregates.battleQuantiles, seasonDays),
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
