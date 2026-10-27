import type { LoadoutMode } from "../loadout-stats";

/**
 * Where players set up on a map and where they deal damage from, read out of
 * the recorded battles (see `battle_spots` and `battle_hits`).
 */

/** How far a vehicle may drift and still be holding the same spot, in metres. */
export const SPOT_RADIUS_METRES = 30;

/** How long a vehicle must hold a place for it to count as its spot, in seconds. */
export const SPOT_HOLD_SECONDS = 20;

/**
 * How long into the battle a spot may still be taken, in seconds.
 *
 * The opening is what the question is about: where to GO. A vehicle still
 * wandering after four minutes has no opening position worth reading, and the
 * place it ends up in is a consequence of the battle rather than a plan.
 */
export const SPOT_DEADLINE_SECONDS = 240;

/** Cells per side of the grid the damage is summed into. */
export const DAMAGE_GRID = 40;

/**
 * Battles a layout needs before its guide is read without a warning.
 *
 * Below it the squares are a first idea rather than a habit: one platoon that
 * took an unusual line moves the ranking. A reading aid and deliberately
 * round, like `CONFIDENT_SPAWN_SAMPLE`, not a confidence interval.
 */
export const CONFIDENT_GUIDE_SAMPLE = 30;

/**
 * The moment of the battle a reader is asking about. A position is only worth
 * taking at a given time: the ridge that farms damage at the start is empty by
 * the seventh minute, and the town the battle ends in is where nobody goes
 * first.
 */
export enum GuidePhase {
  /** The first three minutes: where to go and set up. */
  Opening = 0,
  /** Three to seven minutes: where the fight is held. */
  Middle = 1,
  /** Past seven minutes: where the battle is finished. */
  Late = 2,
}

/** Where each phase but the last ends, in seconds of battle time. */
export const GUIDE_PHASE_ENDS = [180, 420] as const;

export function guidePhaseOf(seconds: number): GuidePhase {
  if (seconds < GUIDE_PHASE_ENDS[0]) return GuidePhase.Opening;
  if (seconds < GUIDE_PHASE_ENDS[1]) return GuidePhase.Middle;
  return GuidePhase.Late;
}

type Point = [number, number, number, number];

/**
 * Where a track was at `at`: the last point at or before it, since the
 * recording writes a position only when it changes. Null before its first.
 */
export function positionAt(
  points: Point[],
  at: number,
): { x: number; z: number } | null {
  let found: Point | null = null;
  for (const point of points) {
    if (point[0] > at) break;
    found = point;
  }
  return found ? { x: found[1], z: found[3] } : null;
}

/**
 * The first place a track held for `SPOT_HOLD_SECONDS` after `from`, or null.
 *
 * Walked as a sequence of anchors: each point starts a candidate stay, which
 * lasts until the vehicle is first seen more than `SPOT_RADIUS_METRES` away.
 * The position at `from` is a candidate too, which is what keeps the vehicles
 * that play from their spawn (artillery, a tank destroyer covering the base).
 *
 * `to` is when the vehicle stopped being alive or seen, so a stay cut short
 * by its death is only a spot if it had already lasted long enough.
 */
export function settleSpot(
  points: Point[],
  from: number,
  to: number,
): { at: number; x: number; z: number } | null {
  if (points.length === 0) return null;
  const deadline = from + SPOT_DEADLINE_SECONDS;
  // The candidates: where it stood at `from`, then every later point.
  let first = 0;
  while (first + 1 < points.length && points[first + 1][0] <= from) first += 1;

  for (let i = first; i < points.length; i += 1) {
    const start = Math.max(points[i][0], from);
    if (start > deadline || start >= to) break;
    const [, x, , z] = points[i];
    let end = to;
    for (let j = i + 1; j < points.length; j += 1) {
      if (points[j][0] >= to) break;
      if (Math.hypot(points[j][1] - x, points[j][3] - z) > SPOT_RADIUS_METRES) {
        end = points[j][0];
        break;
      }
    }
    if (end - start >= SPOT_HOLD_SECONDS) return { at: start, x, z };
  }
  return null;
}

/** One vehicle's opening spot and how its battle went. */
export type MapSpot = {
  team: number;
  /** The client's class tag (`heavyTank`, `AT-SPG`, ...). */
  vehicleClass: string;
  /** Minimap percentages from the top left. */
  left: number;
  top: number;
  /** When it settled there, in seconds of battle time. */
  settledAt: number;
  damage: number;
  kills: number;
  survived: boolean;
  won: boolean;
};

/** Damage dealt from each cell by one side and class, summed. */
export type MapDamageSlice = {
  team: number;
  vehicleClass: string;
  /** One of `GuidePhase`. */
  phase: number;
  /** Occupied cells, `row * DAMAGE_GRID + column`, row 0 at the top. */
  cells: number[];
  /** Damage dealt from each of those cells. */
  damage: number[];
};

/** One killing shot, placed where it was fired from. */
export type MapKill = {
  team: number;
  vehicleClass: string;
  left: number;
  top: number;
  /** Seconds of battle time. */
  at: number;
};

/** Everything placed on one layout of the map, in one mode. */
export type MapPositionLayout = {
  /** The arena it was played on: the map, or a variant folded into it. */
  arenaId: string;
  /** The layout, `ctf`, `domination`, `assault` or `comp7`. */
  gameplayId: string;
  mode: LoadoutMode;
  /** Battles counted. */
  battles: number;
  spots: MapSpot[];
  damage: MapDamageSlice[];
  kills: MapKill[];
};

export type MapPositions = {
  arenaId: string;
  /** Cells per side of the damage grid. */
  grid: number;
  layouts: MapPositionLayout[];
};
