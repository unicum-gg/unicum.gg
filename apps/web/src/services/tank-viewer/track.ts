// The belt, laid link by link along the path the client ships.
//
// The game does not draw a track as a texture on a ribbon: it repeats one link
// mesh along a closed path around the road wheels, and that is what makes a
// track read as a track when the vehicle turns.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import { switched } from "./switches";

/**
 * Which way round a link sits on its path.
 *
 * Counting vertices says the narrow face (12 of them across 4 cm) is the centre
 * guide and the wide one (104 across 70 cm) is the shoe, which argues for the
 * wide face outwards. In the game it is the other way round, so the count is
 * measuring something else: the 12 are the tip of the guide, not the guide.
 *
 * There is nothing in the client to check this against: its own track ribbon,
 * which would have settled it, carries no relief at all. So this is set from
 * what the game shows, and `?links=flip` still swaps it if it ever needs
 * revisiting.
 */
export const linkFacing = () => (switched("links") === "flip" ? 1 : -1);
/**
 * The path a belt follows: the client's own polygon, joined end to end.
 *
 * **Read as straight segments, because that is what a track is.** A belt is
 * rigid links pinned together, so between two pins it is a straight line, and
 * the polygon the client ships is already that line: 71 points around the loop
 * at the median, 88 at the 95th percentile, which puts a corner about every
 * 14 cm, the length of a link.
 *
 * It used to be smoothed with a centripetal Catmull-Rom, on the reasoning that
 * thirty-odd points would make a link snap through a new heading at every
 * corner. The point count was wrong, and so was the consequence. A Catmull-Rom
 * interpolates its points but bulges between them, outwards on a convex turn,
 * which is exactly where a belt wraps a wheel: measured on the E 100, the
 * curve stood **25.7 mm** clear of the client's own polygon at the rear idler,
 * on wheels of 343 to 498 mm radius. That is the gap between the track and the
 * sprocket, and the client never had it.
 *
 * The heading was never the curve's job anyway. `layTrack` lays each link on
 * the chord to the next one rather than on a tangent, so the articulation at a
 * corner comes out of the chord, which is what a rigid link actually does.
 */
export function pathOf(points: number[][]) {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  const at = points.map((p: number[]) => new THREE.Vector3(p[0], p[1], p[2]));
  for (let i = 0; i < at.length; i++) {
    curve.add(new THREE.LineCurve3(at[i]!, at[(i + 1) % at.length]!));
  }
  return { curve, total: curve.getLength() };
}

/**
 * Lay links along one side's path, the way the game does: a link every
 * link-length from `start`, each turned to follow the path.
 *
 * **A run, not the whole belt.** The game lays a belt as one or two of these:
 * the chassis names a second link model and gives each run its own start, half
 * a pitch apart, so what reads as one belt is two interleaved.
 *
 * A link is modelled with its centre guide on the low side and its shoe on the
 * high side. The guide has to point **into** the loop so it rides between the
 * road wheels, which puts the shoe outwards: against the ground on the bottom
 * run, skywards on the top one. So the link's own up axis faces out of the
 * loop, and the belt turns over correctly at each end.
 *
 * A link is laid on the **chord** to the next one, not on the tangent under its
 * own centre. A link is a rigid bar between two pins, and pins sit a straight
 * line apart, so a chord is what it actually spans. Sitting it on the tangent
 * instead lifts both its ends off the curve, by 25 mm on a wheel as small as an
 * idler, and every joint round that wheel opens a gap you can see through. On
 * the chord the ends land back on the curve and consecutive links overlap by a
 * few millimetres, which is what a real track does at the pin.
 */
export function layTrack(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  points: number[][],
  linkLength: number,
  start = 0,
  links?: number,
) {
  let { curve, total } = pathOf(points);
  // A chassis that counts its own links is the better authority than any
  // division: laying exactly that many leaves no part link at the join.
  const count = links ?? Math.max(1, Math.round(total / linkLength));
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const basis = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const along = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const side = new THREE.Vector3();
  // Read here rather than at import: the module must not touch the window to
  // be loaded, and one belt's links all face the same way anyway.
  const facing = linkFacing();
  // Sliding every link by the same distance is how the game runs a track: the
  // belt moves, the path does not.
  const place = (offset: number) => {
    for (let i = 0; i < count; i++) {
      // A tank rolling forward drives its belt backwards along the top run,
      // which is the direction the loop is wound in, so the offset subtracts.
      const t = (((i / count + start / total - offset / total) % 1) + 1) % 1;
      const next = (t + 1 / count) % 1;
      curve.getPointAt(t, at);
      curve.getPointAt(next, ahead);
      along.subVectors(ahead, at).normalize();
      at.lerp(ahead, 0.5);
      // Which way is out of the loop. The link is modelled with its centre
      // guide on one side and its shoe on the other, so this is what decides
      // whether the guide rides between the road wheels or sticks out into the
      // air. The client ships no reference for it: its own ribbon is flat.
      outward.set(0, along.z * facing, -along.y * facing).normalize();
      side.crossVectors(outward, along);
      basis.makeBasis(side, outward, along).setPosition(at);
      mesh.setMatrixAt(i, basis);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  /**
   * Run the same links round a different path.
   *
   * The belt keeps its link count, because that is what the chassis says it
   * has: a suspension that compresses does not add links, it takes up the
   * slack, so the same number spread over a slightly different band is exactly
   * what happens. The instance count never changes, so nothing is rebuilt.
   */
  const reshape = (next: number[][], offset: number) => {
    ({ curve, total } = pathOf(next));
    place(offset);
  };
  return {
    mesh,
    count,
    place,
    reshape,
    get total() {
      return total;
    },
  };
}

/** A wheel as the belt sees it: where it turns, and the circle it runs on. */
export type BeltWheel = {
  axle: THREE.Vector3;
  wrap: number;
};

/** How finely each wheel is sampled when the band is built. */
const WHEEL_SAMPLES = 48;

/** The two-dimensional convex hull of a set of points, anticlockwise in (z, y). */
function hull(points: number[][]): number[][] {
  const sorted = [...points].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  const turn = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const half = (from: number[][]): number[][] => {
    const out: number[][] = [];
    for (const p of from) {
      while (
        out.length >= 2 &&
        turn(out[out.length - 2]!, out[out.length - 1]!, p) <= 0
      )
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * The belt a set of wheels makes on their own.
 *
 * A belt pulled tight around a row of wheels is the convex hull of their
 * circles: an arc where it wraps one, a straight tangent where it spans two.
 * The mirror builds every published path this way, and building it again here
 * is what lets the belt answer to wheels that have moved: a suspension that
 * compresses changes where the wheels are, and the band is the only thing that
 * says what the belt does about it.
 *
 * Wound anticlockwise in (z, y), which is the client's own winding, so links
 * laid on it sit the right way out.
 */
export function bandAround(wheels: BeltWheel[], x: number): number[][] {
  const samples: number[][] = [];
  for (const wheel of wheels) {
    for (let i = 0; i < WHEEL_SAMPLES; i++) {
      const at = (i / WHEEL_SAMPLES) * Math.PI * 2;
      samples.push([
        wheel.axle.z + Math.cos(at) * wheel.wrap,
        wheel.axle.y + Math.sin(at) * wheel.wrap,
      ]);
    }
  }
  const band = hull(samples);
  if (band.length < 3) return [];
  return band.map(([z, y]) => [x, y!, z!]);
}
