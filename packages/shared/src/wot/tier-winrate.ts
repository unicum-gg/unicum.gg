import type { Region } from "@unicum.gg/wargaming";
import { RatingMetric } from "../constants/rating";
import { RATING_COLOR_OF, RATING_DOMAIN } from "./player-distribution";
import type { RatingColor } from "./ratings";

/**
 * What each band of the region's players wins at each tier.
 *
 * The grid the servers page draws: the rating band down the side, the tier
 * across the top, the band's win rate at that tier in the cell. It answers what
 * the histograms beside it cannot, which is not how many players are good but
 * what being good is worth at a given tier, and whether the distance between
 * the bands widens or closes as the tiers go up.
 *
 * Battle-weighted, like the tier shares on the same page: a cell is the band's
 * wins at that tier over its battles there, not the mean of its players' own
 * win rates. The two answer different questions, and the weighted one is the
 * region's actual record at that tier rather than the record of its median
 * account.
 *
 * The client-safe shapes and the pure arithmetic over them. The accumulation
 * and the queries live in core (`players/tier-winrate`), where the grid rides
 * the nightly pass the per-tank leaderboard already makes over the snapshots.
 */

/** One cell: what a band did at one tier. */
export type TierWinrateCell = {
  tier: number;
  band: RatingColor;
  /**
   * The band's edges as they stood when the cell was filled, half-open like
   * `RatingBand`.
   *
   * Carried rather than recomputed from today's thresholds, for the reason the
   * distribution buckets beside this one carry their own edges: which players
   * are in a cell was decided by the colour function at write time, so a row
   * banded last night under a threshold that moved this morning would otherwise
   * be drawn under edges nobody measured it with. Nullable at the two open
   * ends, and on a row written before the columns existed.
   */
  bandFrom: number | null;
  bandTo: number | null;
  /** Accounts of the band with a qualifying vehicle at the tier. */
  players: number;
  battles: number;
  wins: number;
  /** `wins / battles`, 0..1. Derived at read rather than stored, so the two
   * counters stay the only recorded numbers and a cell can be re-summed. */
  winrate: number;
};

export type TierWinrate = {
  region: Region;
  /**
   * Battles a player needs ON a vehicle before it counts towards their tiers.
   *
   * Inherited from the leaderboard pass this rides rather than chosen here: the
   * grid describes the tiers as played by the people who play them, not the
   * fifteen games somebody tried a rental for. Carried so the page can name the
   * population it is drawing.
   */
  minBattles: number;
  /** One grid per rating metric, so the reader's chosen metric is served
   * rather than one being picked for them. */
  metrics: Record<RatingMetric, TierWinrateCell[]>;
  computedAt: Date | null;
};

/** Address of a cell, so the reader that draws the grid and anything else
 * indexing it agree on one key rather than each inventing its own. */
export function tierCellKey(band: RatingColor, tier: number): string {
  return `${band}:${tier}`;
}

/**
 * Battles below which a cell is drawn as an estimate rather than a figure.
 *
 * Ten thousand battles put the sampling error on a win rate at about half a
 * point, which is smaller than the differences the grid is read for. Under
 * that, a cell moves for reasons that are not skill (a handful of players
 * keeping a tier II premium), and drawing it at full strength beside cells with
 * a thousand times the sample would state all of them with the same confidence.
 */
export const TIER_WINRATE_THIN_CELL = 10_000;

/** One band of a rating scale, half-open like a histogram bucket: `from`
 * included, `to` excluded, `null` at either end for the open sides. */
export type RatingBand = {
  color: RatingColor;
  from: number | null;
  to: number | null;
};

const bandCache = new Map<RatingMetric, RatingBand[]>();

/**
 * The bands of one metric's scale, in ascending order.
 *
 * Read off the colour function itself by walking the domain rather than kept
 * as a second copy of its thresholds: those thresholds are already written once
 * in `wn7Color`/`wn8Color`/`wnxColor`, and a table repeating them here would be
 * a table to keep in sync, silently mislabelling every row of the grid the day
 * one of them moves. Memoised, since the walk is the same answer every time.
 */
export function ratingBands(metric: RatingMetric): RatingBand[] {
  const cached = bandCache.get(metric);
  if (cached) return cached;

  const colorOf = RATING_COLOR_OF[metric];
  const bands: RatingBand[] = [];
  let color = colorOf(RATING_DOMAIN.min);
  let from: number | null = null;
  // Whole steps, because every threshold in those functions is an integer, so a
  // unit walk lands exactly on each of them.
  for (let value = RATING_DOMAIN.min + 1; value <= RATING_DOMAIN.max; value++) {
    const next = colorOf(value);
    if (next === color) continue;
    bands.push({ color, from, to: value });
    color = next;
    from = value;
  }
  bands.push({ color, from, to: null });

  bandCache.set(metric, bands);
  return bands;
}

/**
 * The bands one metric's grid actually holds, ascending.
 *
 * Read off the cells rather than off the colour function, so the axis is
 * labelled with the edges the rows were banded with (see `bandFrom`). A band
 * nobody in the region falls into never reaches the payload and so never
 * becomes an empty row. Falls back to today's thresholds for a row written
 * before the edges were stored, which is the one case where the two can
 * disagree.
 */
export function bandsOf(
  cells: TierWinrateCell[],
  metric: RatingMetric,
): RatingBand[] {
  const stored = new Map<RatingColor, RatingBand>();
  for (const cell of cells) {
    if (stored.has(cell.band)) continue;
    if (cell.bandFrom === null && cell.bandTo === null) continue;
    stored.set(cell.band, {
      color: cell.band,
      from: cell.bandFrom,
      to: cell.bandTo,
    });
  }
  const present = new Set(cells.map((cell) => cell.band));
  return ratingBands(metric)
    .filter((band) => present.has(band.color))
    .map((band) => stored.get(band.color) ?? band);
}

/** How a band names itself on an axis: its own range, not a title. The site
 * colours ratings but has never named the colours, and inventing "unicum" here
 * would be a vocabulary only this grid speaks. */
export function ratingBandLabel(band: RatingBand): string {
  if (band.from === null) return `< ${band.to}`;
  if (band.to === null) return `${band.from}+`;
  return `${band.from}-${band.to}`;
}
