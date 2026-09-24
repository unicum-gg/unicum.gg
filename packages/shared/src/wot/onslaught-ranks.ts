import { iconUrl } from "./assets";
import { RatingColor } from "./ratings";

/**
 * Onslaught's rank ladder: the six ranks, the divisions inside them, and where
 * a rating lands on the whole scale.
 *
 * The leaderboard we mirror only ever shows the top two, which is why the mode
 * reads from the outside as though Champion and Legend were the whole of it.
 * They are its last two steps. The client names all six (`rank/first` through
 * `rank/sixth`: Iron, Bronze, Silver, Gold, Champion, Legend) and the four
 * below the prestige pair are each split into five divisions, E up to A, a
 * hundred rating points apart. That is twenty divisions to climb before the
 * board even knows you exist, and it is where nearly every player who asks how
 * they are doing actually is.
 *
 * Almost nothing here is data, because the scale is arithmetic once its one
 * published number is known: Champion begins at 2000 rating points, and the
 * twenty divisions below it divide exactly that. Both halves are Wargaming's
 * own (the guide publishes the threshold and the hundred-point divisions), and
 * the threshold is also measurable: the leaderboard's floor sits at exactly
 * 2000 on all three regions, every pass.
 *
 * Legend is the exception and cannot be a threshold at all: it is the top 15%
 * of the board by POSITION, so what it costs in points is whatever the player
 * at that position holds, it moves every five minutes, and it climbs all
 * season. Callers pass that figure in.
 */
export enum OnslaughtRank {
  Iron = "iron",
  Bronze = "bronze",
  Silver = "silver",
  Gold = "gold",
  Champion = "champion",
  Legend = "legend",
}

/** The ranks that are split into divisions, lowest first. */
export const ONSLAUGHT_DIVIDED_RANKS = [
  OnslaughtRank.Iron,
  OnslaughtRank.Bronze,
  OnslaughtRank.Silver,
  OnslaughtRank.Gold,
] as const;

/** A rank's divisions, lowest first: you climb E to A and then rank up. */
export const ONSLAUGHT_DIVISIONS = ["E", "D", "C", "B", "A"] as const;

export type OnslaughtDivision = (typeof ONSLAUGHT_DIVISIONS)[number];

/** Where Champion starts, which is also the leaderboard's own floor. */
export const ONSLAUGHT_CHAMPION_POINTS = 2000;

/**
 * Points a division spans.
 *
 * Derived rather than written down, from the two published facts it reconciles:
 * the divisions are a hundred points apart and Champion begins at 2000, which
 * is exactly twenty of them. Deriving it means a season that moves the
 * threshold moves the whole ladder with it, instead of leaving nineteen
 * divisions describing a scale that has shifted under them.
 */
export const ONSLAUGHT_DIVISION_POINTS =
  ONSLAUGHT_CHAMPION_POINTS /
  (ONSLAUGHT_DIVIDED_RANKS.length * ONSLAUGHT_DIVISIONS.length);

export const ONSLAUGHT_RANK_LABEL: Record<OnslaughtRank, string> = {
  [OnslaughtRank.Iron]: "Iron",
  [OnslaughtRank.Bronze]: "Bronze",
  [OnslaughtRank.Silver]: "Silver",
  [OnslaughtRank.Gold]: "Gold",
  [OnslaughtRank.Champion]: "Champion",
  [OnslaughtRank.Legend]: "Legend",
};

// The site's own rating scale, in order, so a rank reads at a glance against
// every other coloured figure on the page rather than inventing a sixth palette.
export const ONSLAUGHT_RANK_COLOR: Record<OnslaughtRank, RatingColor> = {
  [OnslaughtRank.Iron]: RatingColor.BelowAvg,
  [OnslaughtRank.Bronze]: RatingColor.Average,
  [OnslaughtRank.Silver]: RatingColor.Good,
  [OnslaughtRank.Gold]: RatingColor.VeryGood,
  [OnslaughtRank.Champion]: RatingColor.Super,
  [OnslaughtRank.Legend]: RatingColor.Top,
};

// The ordinal filename each rank's art lives under in the client GUI, which is
// the same word the client keys its localization by.
const ONSLAUGHT_RANK_ORDINAL: Record<OnslaughtRank, string> = {
  [OnslaughtRank.Iron]: "first",
  [OnslaughtRank.Bronze]: "second",
  [OnslaughtRank.Silver]: "third",
  [OnslaughtRank.Gold]: "fourth",
  [OnslaughtRank.Champion]: "fifth",
  [OnslaughtRank.Legend]: "sixth",
};

/** One step of the ladder: a rank, the division inside it, and what it costs. */
export type OnslaughtStanding = {
  rank: OnslaughtRank;
  /** Null on the two prestige ranks, which have no divisions. */
  division: OnslaughtDivision | null;
  /** Rating points this step begins at. */
  floor: number;
  /** Where the next step begins, null at the top of the ladder. */
  ceiling: number | null;
};

/**
 * The whole ladder, lowest step first.
 *
 * `legendCutoff` is what the last Legend position currently holds. Without it
 * the ladder stops at Champion, which is the honest shape for a season whose
 * board we cannot read: Legend exists, but nobody can say what it costs.
 */
export function onslaughtLadder(
  legendCutoff?: number | null,
): OnslaughtStanding[] {
  const steps: OnslaughtStanding[] = [];
  for (const [rankIndex, rank] of ONSLAUGHT_DIVIDED_RANKS.entries()) {
    for (const [divisionIndex, division] of ONSLAUGHT_DIVISIONS.entries()) {
      const floor =
        (rankIndex * ONSLAUGHT_DIVISIONS.length + divisionIndex) *
        ONSLAUGHT_DIVISION_POINTS;
      steps.push({
        rank,
        division,
        floor,
        ceiling: floor + ONSLAUGHT_DIVISION_POINTS,
      });
    }
  }
  steps.push({
    rank: OnslaughtRank.Champion,
    division: null,
    floor: ONSLAUGHT_CHAMPION_POINTS,
    ceiling: legendCutoff ?? null,
  });
  if (legendCutoff != null) {
    steps.push({
      rank: OnslaughtRank.Legend,
      division: null,
      floor: legendCutoff,
      ceiling: null,
    });
  }
  return steps;
}

/** Where a rating stands on the ladder. */
export function onslaughtRankOf(
  points: number,
  legendCutoff?: number | null,
): OnslaughtStanding {
  const ladder = onslaughtLadder(legendCutoff);
  let current = ladder[0];
  for (const step of ladder) {
    if (points >= step.floor) current = step;
  }
  return current;
}

/**
 * The two ranks a leaderboard position can hold.
 *
 * The board reaches down to Champion and stops, so nothing read off it is ever
 * keyed by the four ranks below: a Gold player is not on it at all.
 */
export type OnslaughtBoardRank = OnslaughtRank.Champion | OnslaughtRank.Legend;

/**
 * Which of the board's two ranks a POSITION holds.
 *
 * The board's own reading rather than the ladder's: the client's
 * `leaderboard_page.py` tags a row Legend when its position is inside the elite
 * cutoff and Champion otherwise, and a position is what the board serves. It
 * says nothing about the twenty divisions below, since nobody down there is on
 * the board at all.
 */
export function onslaughtBoardRank(
  position: number,
  thresholds: {
    elitePosition: number | null;
    masterPosition: number | null;
  },
): OnslaughtBoardRank | null {
  const { elitePosition, masterPosition } = thresholds;
  if (elitePosition != null && position <= elitePosition)
    return OnslaughtRank.Legend;
  if (masterPosition != null && position <= masterPosition)
    return OnslaughtRank.Champion;
  return null;
}

// The sizes (px) a SEASON's rank art is published at. The client also ships a
// 22px set, but only for the season-less art at the tree's root, so listing it
// here would type-check a URL that 404s on every themed crest.
export const ONSLAUGHT_RANK_ICON_SIZES = [
  40, 48, 64, 84, 110, 150, 200, 260, 320, 420, 600,
] as const;

// **The season's themed art is at `ranks/`, and `comp7/ranks/` is where it used
// to be.** Reading the wrong one shows a crest rather than a broken image, which
// is why the board wore the wrong beast for two years without anyone noticing:
// the mode's whole GUI moved into `comp7.pkg`, whose res root mounts as `gui/`,
// so the live crests are at `gui/maps/icons/ranks/...` and no package ships the
// old path any more. What answers there is what the mirror was left holding when
// the move happened, in September 2024, and since the mirror accumulates it will
// answer for ever. Wargaming re-draws the animal every year (a manticore, then a
// dragon, now a phoenix), so a stale crest looks exactly as deliberate as a live
// one.
const ONSLAUGHT_RANK_ICONS = "ranks";

// The rankless badge, worn when we cannot name the season. It stays on the
// abandoned tree deliberately: the current client ships its season-less art at
// 22 and 48 px only, and this is the last place a neutral crest exists at the
// sizes the site asks for. It is not a past season's, so it does not go stale
// the way the themed ones did.
const ONSLAUGHT_RANK_ICONS_PLAIN = "comp7/ranks";

/** URL of a rank's icon from the wot.assets mirror. `seasonOrdinal` selects that
 * season's themed art (the plain default is used when it is null); `assetsRef`
 * pins the art to a mirror commit (a past season's art as it was while live),
 * defaulting to the live branch. `size` is one of `ONSLAUGHT_RANK_ICON_SIZES`. */
export function onslaughtRankIcon(
  rank: OnslaughtRank,
  seasonOrdinal: string | null,
  assetsRef: string | null,
  size: (typeof ONSLAUGHT_RANK_ICON_SIZES)[number] = 84,
): string {
  const base = seasonOrdinal
    ? `${ONSLAUGHT_RANK_ICONS}/${seasonOrdinal}`
    : ONSLAUGHT_RANK_ICONS_PLAIN;
  return iconUrl(
    `${base}/${size}/${ONSLAUGHT_RANK_ORDINAL[rank]}.png`,
    assetsRef ?? undefined,
  );
}
