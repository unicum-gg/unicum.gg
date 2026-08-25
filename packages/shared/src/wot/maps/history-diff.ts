import {
  MAP_BATTLE_TYPE_PREFIX,
  MAP_GEOMETRY_PREFIX,
  MAP_MODE_PREFIX,
  MAP_PLAY_AREA_PREFIX,
  TRACKED_MAP_FIELDS,
} from "./history-fields";
import type { MapHistoryPoint, MapSnapshotData } from "./history-snapshot";

/** One recorded difference between two versions of a map. `previous` / `next`
 * are the stored strings: a number, a camouflage token, the sentinel below for a
 * mode or battle type, or a serialized marker list. Either side is null when the
 * property did not exist on that side. */
export type MapChangeEntry = {
  field: string;
  previous: string | null;
  next: string | null;
};

/** The stored value of a property that is either there or not (a game mode, a
 * battle type). The pair of nulls around it is what carries the meaning. */
export const MAP_PRESENT = "present";

/**
 * How far a marker has to move, in metres, to count as moved.
 *
 * The client re-exports coordinates with slightly different float rounding
 * between builds, and a base or spawn nudged by a couple of metres is invisible
 * both on the minimap and in a battle. Five metres is a tenth of a base capture
 * circle's radius: below that nobody could tell.
 */
export const MARKER_MOVE_THRESHOLD_M = 5;

const dist = (a: MapHistoryPoint, b: MapHistoryPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Serialize a marker list for storage: compact, stable and readable back into
 * points by the UI that draws the before/after overlay. */
export function serializeMarkers(points: MapHistoryPoint[]): string {
  return JSON.stringify(points.map((p) => [p.x, p.z]));
}

/** Read back a serialized marker list; an unparseable value yields no markers
 * rather than throwing, so one malformed row cannot break a history page. */
export function parseMarkers(raw: string | null): MapHistoryPoint[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) =>
      Array.isArray(entry) && entry.length >= 2
        ? [{ x: Number(entry[0]), z: Number(entry[1]) }]
        : [],
    );
  } catch {
    return [];
  }
}

/** One marker's old and new position, and how far apart they are in metres. */
export type MarkerMove = {
  from: MapHistoryPoint;
  to: MapHistoryPoint;
  distance: number;
};

/**
 * Pair a group's old and new markers up.
 *
 * Markers are matched by proximity rather than by position in the list: the
 * client's export order is not stable, and re-ordering the same two spawns is
 * not a change to the map. Each new marker takes the nearest unclaimed old one,
 * which is enough for the handful of markers a mode carries. A marker with
 * nothing left to pair with (the group gained or lost one) yields no move: it
 * appeared or disappeared, it did not travel.
 *
 * Shared with the reader, which draws an arrow along each pair.
 */
export function matchMarkers(
  prev: MapHistoryPoint[],
  next: MapHistoryPoint[],
): MarkerMove[] {
  const unclaimed = [...prev];
  const moves: MarkerMove[] = [];
  for (const point of next) {
    let bestIndex = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < unclaimed.length; i += 1) {
      const d = dist(point, unclaimed[i]);
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) continue;
    moves.push({ from: unclaimed[bestIndex], to: point, distance: best });
    unclaimed.splice(bestIndex, 1);
  }
  return moves;
}

/** Whether a marker group moved: a different count is a change on its own (a
 * spawn was added or removed), otherwise it takes one marker travelling further
 * than the threshold. */
function markersMoved(
  prev: MapHistoryPoint[],
  next: MapHistoryPoint[],
): boolean {
  if (prev.length !== next.length) return true;
  return matchMarkers(prev, next).some(
    (m) => m.distance > MARKER_MOVE_THRESHOLD_M,
  );
}

function diffPresence(
  prefix: string,
  prev: string[],
  next: string[],
): MapChangeEntry[] {
  const before = new Set(prev);
  const after = new Set(next);
  const out: MapChangeEntry[] = [];
  for (const value of after) {
    if (!before.has(value)) {
      out.push({ field: prefix + value, previous: null, next: MAP_PRESENT });
    }
  }
  for (const value of before) {
    if (!after.has(value)) {
      out.push({ field: prefix + value, previous: MAP_PRESENT, next: null });
    }
  }
  return out;
}

/** The gameplay token a geometry key belongs to (`comp7:spawns:team1` -> `comp7`). */
const modeOf = (key: string) => key.slice(0, Math.max(0, key.indexOf(":")));

/**
 * The vector a mode's markers moved by together, or null when they did not.
 *
 * A mode whose markers all shift by the same amount has not been reworked: its
 * play area moved under them. The client does this on its own (a map's world
 * origin gets re-centred between builds, and Onslaught's reduced area is
 * re-cut), and reporting it as "every spawn and base moved" would drown the
 * handful of real changes. What actually changed, the size of that area, is
 * recorded separately by `diffPlayAreas`.
 *
 * The shift only has to be shared by most of the mode's markers, not all of
 * them: a re-cut area and a genuinely moved marker happen in the same patch
 * (Siegfried Line's Onslaught area shrank while its points of interest were
 * redrawn), and the marker that broke ranks is exactly the one worth reporting.
 */
function dominantShift(
  keys: string[],
  prev: MapSnapshotData["geometry"],
  next: MapSnapshotData["geometry"],
): MapHistoryPoint | null {
  const deltas: MapHistoryPoint[] = [];
  let groups = 0;
  for (const key of keys) {
    const before = prev[key];
    const after = next[key];
    if (!before || !after || before.length !== after.length) continue;
    groups += 1;
    // Paired by proximity, like everywhere else here: the client's export order
    // is not stable, and comparing position-in-list would read a re-ordered
    // group as disagreeing about the shift, leave it uncancelled, and report the
    // whole mode as moved.
    for (const move of matchMarkers(before, after)) {
      deltas.push({ x: move.to.x - move.from.x, z: move.to.z - move.from.z });
    }
  }
  // One group agreeing with itself proves nothing: a single moved base would
  // look like a shift of the whole mode.
  if (groups < 2 || deltas.length === 0) return null;

  let best: { shift: MapHistoryPoint; votes: number } | null = null;
  for (const candidate of deltas) {
    const votes = deltas.filter(
      (d) => dist(d, candidate) <= MARKER_MOVE_THRESHOLD_M,
    ).length;
    if (!best || votes > best.votes) best = { shift: candidate, votes };
  }
  if (!best || best.votes * 2 <= deltas.length) return null;
  return dist(best.shift, { x: 0, z: 0 }) > MARKER_MOVE_THRESHOLD_M
    ? best.shift
    : null;
}

/** Whether a group only followed the shift its whole mode underwent. */
function followsShift(
  before: MapHistoryPoint[],
  after: MapHistoryPoint[],
  shift: MapHistoryPoint,
): boolean {
  if (before.length !== after.length) return false;
  return matchMarkers(before, after).every(
    (move) =>
      dist(
        { x: move.to.x - move.from.x, z: move.to.z - move.from.z },
        shift,
      ) <= MARKER_MOVE_THRESHOLD_M,
  );
}

function diffGeometry(
  prev: MapSnapshotData["geometry"],
  next: MapSnapshotData["geometry"],
): MapChangeEntry[] {
  const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
  const shifts = new Map<string, MapHistoryPoint | null>();
  for (const mode of new Set(keys.map(modeOf))) {
    shifts.set(
      mode,
      dominantShift(
        keys.filter((k) => modeOf(k) === mode),
        prev,
        next,
      ),
    );
  }

  const out: MapChangeEntry[] = [];
  for (const key of keys) {
    const before = prev[key];
    const after = next[key];
    if (before && after) {
      const shift = shifts.get(modeOf(key));
      if (shift && followsShift(before, after, shift)) continue;
      if (!markersMoved(before, after)) continue;
    }
    out.push({
      field: MAP_GEOMETRY_PREFIX + key,
      previous: before ? serializeMarkers(before) : null,
      next: after ? serializeMarkers(after) : null,
    });
  }
  return out;
}

/** Resized play areas of the modes that ship one of their own, as `WxH` metres. */
function diffPlayAreas(
  prev: MapSnapshotData["boxes"],
  next: MapSnapshotData["boxes"],
): MapChangeEntry[] {
  const out: MapChangeEntry[] = [];
  const size = (box?: { width: number; height: number }) =>
    box ? `${box.width}x${box.height}` : null;
  for (const mode of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    const before = size(prev[mode]);
    const after = size(next[mode]);
    if (before === after) continue;
    out.push({ field: MAP_PLAY_AREA_PREFIX + mode, previous: before, next: after });
  }
  return out;
}

/**
 * Everything that changed between two versions of the same map.
 *
 * Only differences a player could notice are reported: coordinates are already
 * anchored on the play area (so a re-centred world origin is invisible here) and
 * markers are matched by proximity within a threshold. The result is stable in
 * order, scalars first, so a version's changes read the same way every time.
 */
export function diffMapSnapshots(
  prev: MapSnapshotData,
  next: MapSnapshotData,
): MapChangeEntry[] {
  // One side is a map we can only see through the localization: it has no
  // geometry, no modes and no play area to compare, and reporting the other
  // side's as newly gained would announce a rework of a map nobody touched. It
  // is what happens between the live and Common Test clients, which do not
  // package the same set of arena definitions.
  if ((prev.defined ?? true) !== (next.defined ?? true)) return [];

  const out: MapChangeEntry[] = [];

  for (const field of TRACKED_MAP_FIELDS) {
    const before = prev[field.key];
    const after = next[field.key];
    if (before === after) continue;
    // A map that loses its arena definition reports zeroes, which is a gap in
    // the mirror rather than a play area that shrank to nothing.
    if (typeof after === "number" && (after === 0 || before === 0)) continue;
    out.push({
      field: field.key,
      previous: String(before),
      next: String(after),
    });
  }

  out.push(...diffPresence(MAP_MODE_PREFIX, prev.modes, next.modes));
  out.push(
    ...diffPresence(MAP_BATTLE_TYPE_PREFIX, prev.battleTypes, next.battleTypes),
  );
  out.push(...diffPlayAreas(prev.boxes ?? {}, next.boxes ?? {}));
  out.push(...diffGeometry(prev.geometry, next.geometry));
  return out;
}
