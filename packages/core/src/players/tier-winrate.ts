import {
  DISTRIBUTION_MIN_BATTLES,
  type NewTierWinrate,
  RATING_COLOR_OF,
  RATING_METRICS,
  type RatingBand,
  type RatingColor,
  RatingMetric,
  ratingBands,
  type TierWinrate,
  type TierWinrateCell,
  tierWinrateByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * What each band of the region's players wins at each tier.
 *
 * The accumulator is fed by the nightly `top-players-by-tank` cron, one call
 * per (player, vehicle) latest snapshot, in the pass that cron already makes
 * over `*_tank_snapshots`. That is the whole reason this grid is affordable:
 * a win rate per tier exists nowhere but that 360-million-row table, and the
 * one job licensed to walk it hands us every row with the player joined on.
 *
 * Two properties of that stream are load-bearing here. It is ordered by
 * player_id, so a player's rows arrive contiguously and a band is computed once
 * per player rather than once per vehicle, and distinct players are counted
 * with a comparison rather than a set of two million ids. And it has already
 * reduced each (player, vehicle) to its latest snapshot, so a career total is
 * counted once instead of once per observation of it.
 */

/** One (player, vehicle) career total, as the cron's stream hands it over. */
export type TierWinrateSample = {
  playerId: number;
  /** The player's account-wide ratings, null where they have none. */
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  /** The player's lifetime battles, which is what gates them into the
   * population rather than their record on this one vehicle. */
  playerBattles: number | null;
  tier: number;
  /** Career battles and wins on the vehicle, not a diff between snapshots. */
  battles: number;
  wins: number;
};

/**
 * One cell under construction.
 *
 * It carries its own address rather than having it parsed back out of the map
 * key: a key is a string, and reading three typed fields out of one by
 * splitting it makes every value on the scale a value that must never contain
 * the separator.
 */
type Cell = {
  metric: RatingMetric;
  band: RatingBand;
  tier: number;
  players: number;
  battles: number;
  wins: number;
  /** The last player counted into this cell, so a player with eight tier X
   * vehicles counts as one player and eight vehicles' worth of battles. */
  lastPlayer: number;
};

export type TierWinrateAccumulator = {
  offer(sample: TierWinrateSample): void;
  rows(): NewTierWinrate[];
};

/**
 * Collect the grid from a stream of career totals.
 *
 * `minBattles` is the per-vehicle floor the caller's own query applies, taken
 * as an argument rather than read from a constant here: the grid inherits the
 * leaderboard's rule because it rides the leaderboard's pass, and stamping the
 * number the caller actually used is what keeps the page's caption honest if
 * that rule ever changes.
 */
export function createTierWinrateAccumulator(
  minBattles: number,
): TierWinrateAccumulator {
  const cells = new Map<string, Cell>();
  // Every scale's bands, resolved once: the accumulator files a player under a
  // colour and has to store the edges that colour stood for at this moment, so
  // the reader draws the axis the rows were actually banded with.
  const edges = new Map<RatingMetric, Map<RatingColor, RatingBand>>(
    RATING_METRICS.map((metric) => [
      metric,
      new Map(ratingBands(metric).map((band) => [band.color, band])),
    ]),
  );
  // The current player's band on each scale, recomputed when the stream moves
  // on to the next player. A player with no rating on a scale is absent from
  // this map for that scale rather than filed under a made-up band.
  let bands = new Map<RatingMetric, RatingBand>();
  let playerId = -1;
  let eligible = false;

  function startPlayer(sample: TierWinrateSample): void {
    playerId = sample.playerId;
    // The histograms' own floor, so no account is banded here that would not be
    // counted there: a rating over thirty battles says nothing yet, and filing
    // it under a band would put noise in that band's every tier. In practice a
    // vehicle with a hundred battles already implies a hundred on the account,
    // so this rejects little beyond a row whose account total is unknown. It is
    // a floor, not a matching population: the grid additionally needs a vehicle
    // the player has really played, so it describes a subset of the accounts
    // the histograms describe.
    eligible =
      sample.playerBattles != null &&
      sample.playerBattles >= DISTRIBUTION_MIN_BATTLES;
    bands = new Map();
    if (!eligible) return;
    const values: Record<RatingMetric, number | null> = {
      [RatingMetric.Wn7]: sample.wn7,
      [RatingMetric.Wn8]: sample.wn8,
      [RatingMetric.Wnx]: sample.wnx,
    };
    for (const metric of RATING_METRICS) {
      const value = values[metric];
      if (value == null || !Number.isFinite(value)) continue;
      const band = edges.get(metric)?.get(RATING_COLOR_OF[metric](value));
      if (band) bands.set(metric, band);
    }
  }

  function offer(sample: TierWinrateSample): void {
    if (sample.playerId !== playerId) startPlayer(sample);
    if (!eligible || sample.battles <= 0) return;

    for (const [metric, band] of bands) {
      const key = `${metric}:${band.color}:${sample.tier}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          metric,
          band,
          tier: sample.tier,
          players: 0,
          battles: 0,
          wins: 0,
          lastPlayer: -1,
        };
        cells.set(key, cell);
      }
      if (cell.lastPlayer !== sample.playerId) {
        cell.players++;
        cell.lastPlayer = sample.playerId;
      }
      cell.battles += sample.battles;
      cell.wins += sample.wins;
    }
  }

  function rows(): NewTierWinrate[] {
    return [...cells.values()].map((cell) => ({
      metric: cell.metric,
      band: cell.band.color,
      bandFrom: cell.band.from,
      bandTo: cell.band.to,
      tier: cell.tier,
      minBattles,
      players: cell.players,
      battles: cell.battles,
      wins: cell.wins,
    }));
  }

  return { offer, rows };
}

/**
 * Replace one region's grid.
 *
 * An empty set is refused rather than written. A pass that fails outright never
 * reaches this call (it throws out of the walk, and the stored grid survives by
 * control flow), so what this guards is the other shape: a pass that completed
 * and found nobody. That is either a region with no eligible player, which no
 * live region is, or a change upstream that stopped filling the accumulator. In
 * both readings, swapping a good grid for a blank panel until the next night is
 * the worse answer, so it is logged loudly and yesterday's is kept.
 */
export async function writeTierWinrate(
  region: Region,
  values: NewTierWinrate[],
): Promise<void> {
  if (values.length === 0) {
    console.warn(`[tier-winrate] ${region}: no rows, keeping the stored grid`);
    return;
  }
  const table = tierWinrateByRegion[region];
  await db.transaction(async (tx) => {
    await tx.delete(table);
    await tx.insert(table).values(values);
  });
}

/** Read one region's stored grid. Null before the first nightly run. */
export async function loadTierWinrate(
  region: Region,
): Promise<TierWinrate | null> {
  const table = tierWinrateByRegion[region];
  const rows = await db.select().from(table);
  if (rows.length === 0) return null;

  const metrics = Object.fromEntries(
    RATING_METRICS.map((metric) => [metric, [] as TierWinrateCell[]]),
  ) as Record<RatingMetric, TierWinrateCell[]>;

  for (const row of rows) {
    // A metric the site has since dropped still has its rows here until the
    // next run rewrites the table, and they belong to no grid.
    const cells = metrics[row.metric];
    if (!cells) continue;
    cells.push({
      tier: row.tier,
      band: row.band,
      bandFrom: row.bandFrom,
      bandTo: row.bandTo,
      players: row.players,
      battles: row.battles,
      wins: row.wins,
      winrate: row.battles > 0 ? row.wins / row.battles : 0,
    });
  }
  for (const cells of Object.values(metrics)) {
    cells.sort((a, b) => a.tier - b.tier);
  }

  // Read across the rows rather than off whichever one the scan returned first:
  // today they are written in one transaction and all carry the same two
  // values, and the day that stops being true the caption should name the
  // newest run and the strictest floor rather than an arbitrary row's.
  return {
    region,
    minBattles: Math.max(...rows.map((row) => row.minBattles)),
    metrics,
    computedAt: new Date(
      Math.max(...rows.map((row) => row.computedAt.getTime())),
    ),
  };
}
