/**
 * The largest countdown worth believing, in seconds.
 *
 * Two minutes. The real one is tens of seconds, and anything past this is a
 * sign the survivors' tracks are not anchoring anything, not a long wait.
 */
const MAX_OFFSET = 120;

/**
 * How far a recording's clock runs ahead of the battle's, in seconds.
 *
 * A replay starts recording during the countdown, so its clock is not battle
 * time. The vehicles that survived are what pins the two together: they lived
 * exactly as long as the battle, so the gap between where their track ends and
 * their own `lifeTime` is the offset, and they all agree on it (measured on a
 * real battle: 52.6 s for every survivor, against 57 to 69 for the dead, whose
 * wrecks keep reporting for a while after they stop being alive).
 *
 * The median rather than any one of them, so a single odd track cannot move
 * it. Null when nobody survived, and the caller then decides what to do
 * without the anchor rather than being handed a guess.
 *
 * Shared by the replay viewer, which greys the wrecks with it, and by the map
 * heatmap, which starts counting time at the end of the countdown.
 */
export function replayClockOffset(
  /** Each track's id and its last point, in seconds on the replay's clock. */
  tracks: { id: number; last: number }[],
  vehicles: { id: number; lifeTime: number; died: boolean }[],
): number | null {
  const ends = new Map(tracks.map((track) => [track.id, track.last]));
  const gaps: number[] = [];
  for (const vehicle of vehicles) {
    if (vehicle.died || vehicle.lifeTime <= 0) continue;
    const last = ends.get(vehicle.id);
    if (last === undefined) continue;
    const gap = last - vehicle.lifeTime;
    // A survivor's track cannot end BEFORE the battle it survived, so a
    // negative gap is not a measurement of the countdown, it is a track that
    // stopped early: a training room where somebody left and came back, a
    // vehicle the recording client lost for the rest of the battle. Dropped
    // rather than averaged in, because one of them drags the median under
    // zero and a negative offset puts every death before the recording
    // starts, which draws a full team as wrecks on the first frame. Seen on a
    // real battle: an offset of -86.8s and a tank dead at -57.9s.
    if (gap < 0) continue;
    gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  // And a last net on the other side. The countdown is tens of seconds; an
  // offset of several minutes means the anchor is wrong whatever its sign, and
  // greying nothing is better than greying the wrong things.
  return median > MAX_OFFSET ? null : median;
}

/**
 * When the battle started, read off the first team mate to move, in seconds on
 * the replay's clock, or null when nobody moved.
 *
 * The fallback for `replayClockOffset`, which needs a survivor whose track
 * runs to the end, and a recording that stops when its player leaves the
 * battle has none: the stream ends minutes before the battle does. Nothing can
 * move during the countdown, and on a real battle the first team mate to
 * leave its spawn did so 0.2 s after the survivors put the start (51.2 against 51.0), so
 * the earliest departure is the start to within a fraction of a second.
 *
 * Team mates only, because their positions arrive from the first second while
 * an enemy's first point is the moment it was spotted, which can be minutes
 * in and is itself a "move" from nowhere.
 */
export function replayStartFromMovement(
  tracks: { points: [number, number, number, number][] }[],
): number | null {
  let start: number | null = null;
  for (const { points } of tracks) {
    if (points.length === 0) continue;
    const [, x0, , z0] = points[0];
    // Two metres, so the settling jitter of a hull on its spawn is not read as
    // a departure.
    const moved = points.find(
      ([, x, , z]) => Math.hypot(x - x0, z - z0) > 2,
    );
    if (moved && (start === null || moved[0] < start)) start = moved[0];
  }
  return start;
}
