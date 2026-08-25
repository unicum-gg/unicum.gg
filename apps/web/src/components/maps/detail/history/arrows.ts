/** A point on the minimap, in percent of the image. */
export type ArrowPoint = { x: number; y: number };

/** A drawn arrow: an SVG path from the old marker to the new one, already
 * stopped short of the head's target. */
export type Arrow = { path: string };

/** How far apart two arrows' midpoints can be, in percent of the map, and how
 * closely their directions can agree, before they are treated as running
 * alongside each other. Generous on both: what matters is that a reader can tell
 * two arrows apart, not that they are geometrically parallel. */
const ALONGSIDE_DISTANCE = 14;
const ALONGSIDE_ANGLE = Math.PI / 9; // 20°

/** How far each rank of a fanned-out group bends away from the straight line,
 * in percent of the map. */
const BEND_STEP = 5;

/** Where the head stops, in percent, so it sits against the marker rather than
 * under it. */
const HEAD_GAP = 3;

/** How much room to leave around a marker the arrow is not attached to, in
 * percent of the map. A marker is drawn at 12 px on a ~250 px minimap, so its
 * radius is a little over 2%; this clears it plus a hair of daylight. */
const MARKER_CLEARANCE = 3.4;

/** A point this close to an arrow's own endpoint, in percent, is that endpoint:
 * an arrow is not an obstacle to itself. */
const SAME_POINT = 0.6;

/** Bends tried when the fanned-out arrow still crosses a marker, as multiples of
 * `BEND_STEP` added to it: nudge each way, then further, then further still. The
 * first that clears everything wins, so an arrow moves as little as it can. */
const DETOURS = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2, 3, -3];

const sub = (a: ArrowPoint, b: ArrowPoint) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: ArrowPoint) => Math.hypot(v.x, v.y) || 1;
const mid = (a: ArrowPoint, b: ArrowPoint) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** The unsigned angle between two directions, 0 when they point the same way. */
function angleBetween(a: ArrowPoint, b: ArrowPoint): number {
  const cos = (a.x * b.x + a.y * b.y) / (len(a) * len(b));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

type Move = { from: ArrowPoint; to: ArrowPoint };

/** Whether two moves would be drawn on top of each other: near-parallel, and
 * close enough that their lines overlap rather than merely point the same way. */
function alongside(a: Move, b: Move): boolean {
  if (angleBetween(sub(a.to, a.from), sub(b.to, b.from)) > ALONGSIDE_ANGLE) {
    return false;
  }
  return len(sub(mid(a.from, a.to), mid(b.from, b.to))) < ALONGSIDE_DISTANCE;
}

/**
 * Group the moves that would be drawn on top of one another.
 *
 * Greedy and transitive by design: an arrow joins the first group it runs
 * alongside, so a row of three parallel arrows ends up as one group of three
 * rather than two overlapping pairs.
 */
function cluster(moves: Move[]): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < moves.length; i += 1) {
    const group = groups.find((g) => g.some((j) => alongside(moves[i], moves[j])));
    if (group) group.push(i);
    else groups.push([i]);
  }
  return groups;
}

type Curve = { from: ArrowPoint; control: ArrowPoint; end: ArrowPoint };

/**
 * The quadratic curve for one move at a given bend: `bend` is how far the middle
 * bows sideways, in percent, and the end stops short so the head lands against
 * the marker rather than under it.
 */
function curveFor(move: Move, bend: number): Curve {
  const { from, to } = move;
  const d = sub(to, from);
  const length = len(d);
  const centre = mid(from, to);
  // Perpendicular to the arrow, so the bend pushes it sideways rather than
  // lengthening it. Scaled down on a short arrow, which has no room to bow.
  const scaled = bend * Math.min(1, length / 20);
  const control = {
    x: centre.x - (d.y / length) * scaled,
    y: centre.y + (d.x / length) * scaled,
  };
  // The head follows the curve's final tangent, which runs from the control
  // point, so the gap is measured along that instead of along the chord.
  const tangent = sub(to, control);
  const tl = len(tangent);
  const gap = Math.min(HEAD_GAP, tl / 2);
  return {
    from,
    control,
    end: { x: to.x - (tangent.x / tl) * gap, y: to.y - (tangent.y / tl) * gap },
  };
}

/** A point on a quadratic Bézier at `t`. */
function pointAt(c: Curve, t: number): ArrowPoint {
  const u = 1 - t;
  return {
    x: u * u * c.from.x + 2 * u * t * c.control.x + t * t * c.end.x,
    y: u * u * c.from.y + 2 * u * t * c.control.y + t * t * c.end.y,
  };
}

/**
 * How close the curve comes to the nearest marker it is not attached to.
 *
 * Sampled along the curve rather than solved: twenty points on a path this short
 * are well under the clearance we are testing for, and it keeps the test the
 * same shape whatever the curve.
 */
function clearance(c: Curve, move: Move, obstacles: ArrowPoint[]): number {
  const SAMPLES = 20;
  let worst = Number.POSITIVE_INFINITY;
  for (const o of obstacles) {
    // Its own endpoints are not obstacles: an arrow starts and ends on markers.
    if (len(sub(o, move.from)) < SAME_POINT || len(sub(o, move.to)) < SAME_POINT) {
      continue;
    }
    for (let i = 0; i <= SAMPLES; i += 1) {
      const d = len(sub(pointAt(c, i / SAMPLES), o));
      if (d < worst) worst = d;
    }
  }
  return worst;
}

const round = (v: number) => Math.round(v * 100) / 100;
const toPath = (c: Curve) =>
  `M ${round(c.from.x)} ${round(c.from.y)} Q ${round(c.control.x)} ${round(c.control.y)} ${round(c.end.x)} ${round(c.end.y)}`;

/**
 * Turn each marker move into an arrow, fanning apart the ones that would
 * otherwise be drawn on top of each other and steering each around the markers
 * it does not belong to.
 *
 * Two things make a bundle of arrows unreadable on a 250 px minimap. A patch
 * that shifts a whole mode's markers the same way draws parallel lines on top of
 * one another, so arrows that run alongside each other are bent away from the
 * straight line by rank, symmetrically around it, opening the bundle into a fan.
 * And a line that grazes a third marker reads as if it started or ended there,
 * so each arrow then tries a few widening detours and keeps the first that
 * clears every other marker (or, failing that, the one that passes furthest from
 * them).
 *
 * Bending never moves an endpoint: only the middle of the curve travels, so an
 * arrow always starts and ends exactly where its marker did.
 */
export function buildArrows(moves: Move[], obstacles: ArrowPoint[] = []): Arrow[] {
  const arrows: Arrow[] = new Array<Arrow>(moves.length);

  for (const group of cluster(moves)) {
    group.forEach((index, rank) => {
      const move = moves[index];
      const fan = group.length > 1 ? rank - (group.length - 1) / 2 : 0;
      const base = fan * BEND_STEP;

      let best: { curve: Curve; clearance: number } | null = null;
      for (const detour of DETOURS) {
        const candidate = curveFor(move, base + detour * BEND_STEP);
        const room = clearance(candidate, move, obstacles);
        if (room >= MARKER_CLEARANCE) {
          best = { curve: candidate, clearance: room };
          break;
        }
        if (!best || room > best.clearance) best = { curve: candidate, clearance: room };
      }

      arrows[index] = { path: toPath(best?.curve ?? curveFor(move, base)) };
    });
  }

  return arrows;
}
