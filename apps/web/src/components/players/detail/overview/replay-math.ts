import { FAR_LOST } from "@unicum.gg/shared";
import type { Track } from "./replay-types";

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The longest gap, in seconds, worth sliding across.
 *
 * Positions arrive about ten a second, so a normal step is a tenth. Anything
 * much longer is not a vehicle moving slowly, it is a vehicle nobody could
 * see: the stream only carries what the recording client was shown, so a tank
 * that goes unspotted for twenty seconds reappears somewhere else entirely.
 * Sliding across that would draw it gliding through half the map, which is
 * what the first version refused by never interpolating at all.
 */
const SLIDE_LIMIT_S = 1.5;

/**
 * How stale a position may be and still count as "somebody can see this".
 *
 * A spotted vehicle sends about ten positions a second, and it keeps sending
 * them while standing still: measured on one battle, a third of a track's
 * segments move less than half a metre, so silence means lost sight of rather
 * than stopped. The split is clean rather than arbitrary, which is why the
 * exact second matters so little: a third of the battle falls in long gaps at
 * a half-second threshold and still a third at three seconds. Gaps are either
 * a tenth of a second or they are tens of them.
 */
const SPOT_GAP_S = 1;

/** The longest gap between two far positions that still means "in sight":
 * they come every two seconds, and a beat is dropped now and then. */
const FAR_GAP_S = 4.5;

/** How often the server checks a far vehicle for having moved, in seconds. */
const FAR_STEP_S = 2;

/** How long an ally's silence lasts before its place counts as a guess. */
const ESTIMATE_GAP_S = 5;

/** `deathReason` when a vehicle was still alive at the end. */
export const SURVIVED = -1;

/**
 * The order THIS bar uses, which is not the order a vehicle list uses.
 *
 * The game has two tables and they disagree. `VEHICLE_TYPES_ORDER` (light,
 * medium, heavy, tank destroyer, artillery) is for lists of vehicles, a crew
 * filter or a garage carousel. The battle bar reads
 * `VEHICLE_BATTLE_TYPES_ORDER` instead, `gui/shared/gui_items/Vehicle.py:110`:
 *
 *     heavy, medium, tank destroyer, light, artillery
 *
 * Taking the first was this file's mistake. Both are in the sources, both are
 * named plausibly, and only one is this widget's.
 */
const CLASS_ORDER = ["heavyTank", "mediumTank", "AT-SPG", "lightTank", "SPG"];

export function classRank(type: string | null): number {
  const at = type ? CLASS_ORDER.indexOf(type) : -1;
  // Anything the catalogue does not name sorts last rather than first, so one
  // unknown vehicle cannot head a team.
  return at === -1 ? CLASS_ORDER.length : at;
}

export function hpAt(track: Track, at: number, ticks: number): number {
  const now = at * ticks;
  let hp = track.maxHealth;
  for (const [when, value] of track.health) {
    if (when > now) break;
    hp = value;
  }
  // Clamped at zero: the shot that kills reports a NEGATIVE health, which is
  // the overkill, and a team total is not owed a debt.
  return Math.max(0, Math.min(track.maxHealth, hp));
}

/**
 * The share of its hit points a vehicle still had at `at`, from 0 to 1.
 *
 * The last value the recording client was told, not an interpolation: health
 * does not drift, it drops when a shell lands. Full until the first change,
 * which is why the series can be empty for a vehicle that was never hit.
 */
export function healthAt(track: Track, at: number, ticks: number): number | null {
  if (!track.maxHealth) return null;
  return hpAt(track, at, ticks) / track.maxHealth;
}

/** Where a vehicle's gun points at this moment, or null when never heard. */
export function aimAt(track: Track, at: number, ticks: number): number | null {
  const aim = track.aim;
  if (!aim?.length) return null;
  const now = at * ticks;
  let lo = 0;
  let hi = aim.length - 1;
  if (aim[0][0] > now) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (aim[mid][0] <= now) lo = mid;
    else hi = mid - 1;
  }
  return aim[lo][1];
}

/** Where a vehicle is, and whether anyone can currently see it there. */
export type Seen = {
  x: number;
  z: number;
  spotted: boolean;
  /** Glided across a stretch the recording holds nothing for (see `glide`). */
  estimated?: boolean;
  /** Placed from the minimap's far positions: where, but not where it aims. */
  far?: boolean;
};

/** The last value of a `[tick, value]` series at this tick, or null before it starts. */
export function valueAt(series: [number, number][], now: number): number | null {
  let value: number | null = null;
  for (const [when, next] of series) {
    if (when > now) break;
    value = next;
  }
  return value ?? series[0]?.[1] ?? null;
}

/** How long the binoculars wait for a vehicle to stand still: the client's
 * `activateWhenStillSec`, the same for every grade. */
export const BINOCULARS_DELAY_S = 3;

/**
 * How long, in seconds, a vehicle has stood where it is. A position is only
 * written down when it changes, so this is the time since the last one, and
 * only while a later one exists: past the track's end the vehicle is not still,
 * it is unknown.
 */
export function stillFor(points: [number, number, number][], at: number, ticks: number): number {
  const now = at * ticks;
  let last: number | null = null;
  for (const point of points) {
    if (point[0] > now) return last === null ? 0 : (now - last) / ticks;
    last = point[0];
  }
  return 0;
}

/**
 * Where a vehicle was at `at` seconds, between its two nearest samples.
 *
 * Interpolated, because the samples are half a second apart and stepping
 * between them reads as a stutter rather than as movement. Straight-line
 * between two points 8 m apart is a very good approximation of a tank's path;
 * it is only across a long gap that it becomes a lie, which `SLIDE_LIMIT`
 * refuses.
 */
/** A path point: `[tick, x, z]`, with a fourth `1` when it is a far one, `2`
 * when it is the team losing the vehicle (at the last place it was). */
export type PathPoint = [number, number, number] | [number, number, number, number];

const paths = new WeakMap<Track, PathPoint[]>();

/**
 * A vehicle's whole path: the positions the recording tracked it at, and the
 * minimap's every two seconds while it was too far for that, in one list.
 * Built once per track.
 */
export function pathOf(track: Track): PathPoint[] {
  const cached = paths.get(track);
  if (cached) return cached;
  if (!track.far?.length) {
    paths.set(track, track.points);
    return track.points;
  }
  const path: PathPoint[] = [
    ...track.points,
    ...track.far.map(([at, x, z]): PathPoint => [at, x, z, 1]),
  ].sort((a, b) => a[0] - b[0]);
  // A loss carries no place: it stays where the vehicle was last drawn.
  path.forEach((point, at) => {
    if (point[1] !== FAR_LOST) return;
    const before = path[at - 1];
    path[at] = [point[0], before?.[1] ?? 0, before?.[2] ?? 0, 2];
  });
  paths.set(track, path);
  return path;
}

export function pointAt(
  points: PathPoint[],
  at: number,
  ticks: number,
  startsAt: number,
  /**
   * For the recorder's own side. An ally is never out of the team's sight, but
   * the recording only holds the vehicles within 565 m of the recorder (the
   * game draws the others from a minimap message the replay does not keep),
   * so an ally past that range simply stops reporting. With this set it stays
   * on the map, moved in a straight line from where it left to where it came
   * back, and marked `estimated` so it is drawn faded. A gap of a few seconds
   * is not marked: the stream drops a beat now and then for a vehicle in full
   * view, and fading it for that would make allies flicker.
   */
  glide = false,
): Seen | null {
  const now = at * ticks;
  let before: PathPoint | null = null;
  let after: PathPoint | null = null;
  for (const point of points) {
    if (point[0] <= now) before = point;
    else {
      after = point;
      break;
    }
  }
  if (!before) return null;
  // The minimap's far positions: sent only when the vehicle moved, so until the
  // next one (or the team losing it) it is in sight and standing where it was.
  // It moved somewhere in the last two seconds before the next one, which is
  // the only stretch worth sliding across.
  if (before[3] === 1) {
    const span = after ? after[0] - before[0] : Infinity;
    const k = after && after[3] !== 2 && span <= FAR_GAP_S * ticks
      ? (now - before[0]) / span
      : after && after[3] !== 2 && after[0] - now <= FAR_STEP_S * ticks
        ? 1 - (after[0] - now) / (FAR_STEP_S * ticks)
        : 0;
    return {
      x: before[1] + ((after?.[1] ?? before[1]) - before[1]) * k,
      z: before[2] + ((after?.[2] ?? before[2]) - before[2]) * k,
      spotted: true,
      far: true,
    };
  }
  // The team lost it: where it was last drawn, out of sight.
  if (before[3] === 2 && !glide) return { x: before[1], z: before[2], spotted: false };
  // During the countdown every vehicle is on its spawn and perfectly still,
  // and a position is only written down when it changes, so the gap test would
  // call the whole field unspotted and draw thirty dots. Nobody is hidden
  // before the battle starts.
  const counting = now < startsAt;
  // Nothing after it: the recording holds no more of this vehicle, so this is
  // where it was last seen and not where it is.
  if (!after) {
    return glide && !counting
      ? { x: before[1], z: before[2], spotted: true, estimated: true, far: Boolean(before[3]) }
      : { x: before[1], z: before[2], spotted: counting, far: Boolean(before[3]) };
  }

  const span = after[0] - before[0];
  // The minimap's far positions come every two seconds rather than ten a
  // second, so a gap between two of them, or between one and a tracked
  // position, is judged on that cadence instead.
  const gap = before[3] || after[3] ? FAR_GAP_S : SPOT_GAP_S;
  const spotted = counting || (span > 0 && span <= gap * ticks);
  if (!spotted && glide) {
    const k = (now - before[0]) / span;
    return {
      x: before[1] + (after[1] - before[1]) * k,
      z: before[2] + (after[2] - before[2]) * k,
      spotted: true,
      estimated: span > ESTIMATE_GAP_S * ticks,
      far: Boolean(before[3] || after[3]),
    };
  }
  if (!spotted || span > Math.max(SLIDE_LIMIT_S, gap) * ticks) {
    return { x: before[1], z: before[2], spotted, far: Boolean(before[3] || after[3]) };
  }
  const k = (now - before[0]) / span;
  return {
    x: before[1] + (after[1] - before[1]) * k,
    z: before[2] + (after[2] - before[2]) * k,
    spotted,
    far: Boolean(before[3] || after[3]),
  };
}
