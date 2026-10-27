import type { MapDamageSlice, MapKill, MapSpot } from "@unicum.gg/shared";
import { colLabel, rowLabel } from "@/components/maps/detail/minimap-grid";

/**
 * The arithmetic behind the minimap's positions layer, kept apart from the
 * components that draw it.
 */

/** One square of the minimap grid, and what the recorded battles did there. */
export type GuideSquare = {
  /** The square as players call it, `F6`. */
  name: string;
  /** Where to put its marker: the centre of what happened in it. */
  left: number;
  top: number;
  /** Its share of the players (opening) or of the damage (later). */
  share: number;
  /** Players who set up here, at the opening. */
  players: number;
  /** Their average damage over the battle, at the opening. */
  avgDamage: number;
  /** Damage dealt from here, later in the battle. */
  damage: number;
  /** Kills made from here in the same phase. */
  kills: number;
};

/** The square a minimap position falls in. */
function squareOf(left: number, top: number, cols: number, rows: number) {
  const col = Math.min(cols - 1, Math.max(0, Math.floor((left / 100) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((top / 100) * rows)));
  return { key: row * cols + col, name: `${rowLabel(row)}${colLabel(col, cols)}` };
}

type Accumulator = GuideSquare & { weight: number; damageSum: number };

function emptySquare(name: string): Accumulator {
  return {
    name,
    left: 0,
    top: 0,
    share: 0,
    players: 0,
    avgDamage: 0,
    damage: 0,
    kills: 0,
    weight: 0,
    damageSum: 0,
  };
}

/** Add a weighted point to a square's running centre. */
function pull(square: Accumulator, left: number, top: number, weight: number) {
  const total = square.weight + weight;
  if (total <= 0) return;
  square.left = (square.left * square.weight + left * weight) / total;
  square.top = (square.top * square.weight + top * weight) / total;
  square.weight = total;
}

/**
 * Where players set up, square by square, most taken first: the answer to
 * "where do I go" at the start of a battle.
 */
export function spotSquares(
  spots: MapSpot[],
  kills: MapKill[],
  cols: number,
  rows: number,
): GuideSquare[] {
  const squares = new Map<number, Accumulator>();
  for (const spot of spots) {
    const { key, name } = squareOf(spot.left, spot.top, cols, rows);
    const square = squares.get(key) ?? emptySquare(name);
    pull(square, spot.left, spot.top, 1);
    square.players += 1;
    square.damageSum += spot.damage;
    squares.set(key, square);
  }
  for (const kill of kills) {
    const square = squares.get(squareOf(kill.left, kill.top, cols, rows).key);
    if (square) square.kills += 1;
  }
  return [...squares.values()]
    .map((square) => ({
      ...square,
      share: square.players / Math.max(1, spots.length),
      avgDamage: square.damageSum / Math.max(1, square.players),
    }))
    .sort((a, b) => b.players - a.players || b.avgDamage - a.avgDamage);
}

/**
 * Where the damage was dealt from, square by square, most first: the answer
 * to "where is the fight" once the battle has settled.
 */
export function damageSquares(
  values: Float32Array,
  grid: number,
  kills: MapKill[],
  cols: number,
  rows: number,
): GuideSquare[] {
  const squares = new Map<number, Accumulator>();
  let total = 0;
  for (let cell = 0; cell < values.length; cell += 1) {
    const damage = values[cell];
    if (damage <= 0) continue;
    total += damage;
    const left = ((cell % grid) + 0.5) * (100 / grid);
    const top = (Math.floor(cell / grid) + 0.5) * (100 / grid);
    const { key, name } = squareOf(left, top, cols, rows);
    const square = squares.get(key) ?? emptySquare(name);
    pull(square, left, top, damage);
    square.damage += damage;
    squares.set(key, square);
  }
  for (const kill of kills) {
    const square = squares.get(squareOf(kill.left, kill.top, cols, rows).key);
    if (square) square.kills += 1;
  }
  return [...squares.values()]
    .map((square) => ({ ...square, share: square.damage / Math.max(1, total) }))
    .sort((a, b) => b.damage - a.damage);
}

/** Sum the chosen slices into one dense grid of damage. */
export function sumDamage(slices: MapDamageSlice[], grid: number): Float32Array {
  const out = new Float32Array(grid * grid);
  for (const slice of slices) {
    for (let i = 0; i < slice.cells.length; i += 1) {
      out[slice.cells[i]] += slice.damage[i];
    }
  }
  return out;
}

/**
 * A Gaussian of 1.2 cells, cut where it has faded to nothing.
 *
 * Applied along each axis in turn, so a lone cell spreads into the product
 * of two of these, which is only round when the cut is far enough out. A
 * five-tap kernel stopped at two cells, where the square-root scale of
 * `paint` still lifts the tail well over the visible threshold, and every
 * isolated firing position was drawn as a square.
 */
const SIGMA = 1.2;
const RADIUS = 5;
const KERNEL = (() => {
  const raw = Array.from({ length: RADIUS * 2 + 1 }, (_, i) =>
    Math.exp(-((i - RADIUS) ** 2) / (2 * SIGMA * SIGMA)),
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
})();

/**
 * Soften the grid by a cell or two each way, so a firing position reads as
 * "around here" rather than as one square of twenty-five metres.
 */
export function blur(values: Float32Array, grid: number): Float32Array {
  const pass = (from: Float32Array, horizontal: boolean) => {
    const to = new Float32Array(from.length);
    const half = (KERNEL.length - 1) / 2;
    for (let row = 0; row < grid; row += 1) {
      for (let col = 0; col < grid; col += 1) {
        let sum = 0;
        for (let k = 0; k < KERNEL.length; k += 1) {
          const r = horizontal ? row : row + k - half;
          const c = horizontal ? col + k - half : col;
          if (r < 0 || r >= grid || c < 0 || c >= grid) continue;
          sum += from[r * grid + c] * KERNEL[k];
        }
        to[row * grid + col] = sum;
      }
    }
    return to;
  };
  return pass(pass(values, true), false);
}

/** Colour stops, `[position, r, g, b, alpha]`, from cold and clear to hot. */
const RAMP: [number, number, number, number, number][] = [
  [0, 250, 204, 21, 0],
  [0.15, 250, 204, 21, 0.35],
  [0.5, 249, 115, 22, 0.6],
  [1, 220, 38, 38, 0.85],
];

/** The CSS gradient the legend draws, from the same stops as the picture. */
export const RAMP_GRADIENT = `linear-gradient(to right, ${RAMP.map(
  ([at, r, g, b, a]) => `rgba(${r},${g},${b},${Math.max(a, 0.25)}) ${at * 100}%`,
).join(", ")})`;

function colourAt(t: number): [number, number, number, number] {
  for (let i = 1; i < RAMP.length; i += 1) {
    const [at, r, g, b, a] = RAMP[i];
    const [pat, pr, pg, pb, pa] = RAMP[i - 1];
    if (t <= at) {
      const f = (t - pat) / (at - pat);
      return [pr + (r - pr) * f, pg + (g - pg) * f, pb + (b - pb) * f, pa + (a - pa) * f];
    }
  }
  const [, r, g, b, a] = RAMP[RAMP.length - 1];
  return [r, g, b, a];
}

/**
 * The grid as pixels, one per cell, for a canvas the browser scales up
 * smoothly. On a square-root scale, so one sniper's ridge does not leave
 * every other firing position invisible.
 */
export function paint(values: Float32Array, grid: number): ImageData {
  const image = new ImageData(grid, grid);
  let max = 0;
  for (const value of values) if (value > max) max = value;
  if (max <= 0) return image;
  for (let i = 0; i < values.length; i += 1) {
    const t = Math.sqrt(values[i] / max);
    if (t < 0.03) continue;
    const [r, g, b, a] = colourAt(t);
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = Math.round(a * 255);
  }
  return image;
}
