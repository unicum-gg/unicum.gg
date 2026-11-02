// Holding a rebuilt band down to where the hull carries the belt.
//
// **The taut band is the belt's outer limit, not its shape.** The band round a
// set of wheels is where a belt pulled tight has to pass, and it is the whole
// answer only while the wheels are what the belt rests on. On 143 vehicles
// something else carries the top run: a return roller the chassis never
// declares as a wheel, a guide rail along the sponson, the hull roof. There the
// band is the tangent over the two tallest wheels and the belt goes through
// whatever is above it, which on the Crusher is 383 mm of air and then the
// fender.
//
// The mirror reads where it really goes off the ribbon every chassis bakes for
// its own distant LOD, and publishes it per side as `tracks.ceilings`. That
// shape cannot be drawn up close (every one of its vertices is bound to a
// single bone at full weight, so moving any part of it tears the band open),
// but it is still the client's own answer to where the belt sits at rest.
//
// Its source of truth stays `unicum-gg/wot.build`, `lib/ceiling.ts`.
import * as THREE from "three";

/** A wheel as the ceiling sees it: where it turns, and the circle it carries. */
export type CeilingWheel = {
  axle: THREE.Vector3;
  wrap: number;
};

/** Two points this close carry no shape and wreck the link spacing. */
const APART = 0.002;

/** The profile's own height at a z, or null where it says nothing there. */
function profileAt(profile: number[][], z: number): number | null {
  if (profile.length === 0) return null;
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  if (z < first[0]! || z > last[0]!) return null;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1]!;
    const b = profile[i]!;
    if (z > b[0]!) continue;
    const span = b[0]! - a[0]!;
    return span === 0
      ? Math.min(a[1]!, b[1]!)
      : a[1]! + ((z - a[0]!) / span) * (b[1]! - a[1]!);
  }
  return last[1]!;
}

/** The highest any wheel circle reaches at a z, or null where none does. */
function wheelsAt(wheels: CeilingWheel[], z: number): number | null {
  let best: number | null = null;
  for (const wheel of wheels) {
    const gap = Math.abs(z - wheel.axle.z);
    if (gap >= wheel.wrap) continue;
    const top = wheel.axle.y + Math.sqrt(wheel.wrap * wheel.wrap - gap * gap);
    if (best === null || top > best) best = top;
  }
  return best;
}

/**
 * Turn a ceiling into the frame the belt is drawn in.
 *
 * **A guide is bolted to the hull, so it travels with the hull.** The belt is
 * drawn in the chassis's own frame, where a wheel on an arm stays put and a
 * wheel bolted to the body appears to swing: a vehicle taking aim pushes its
 * body up at one end over road wheels the ground is holding still. The ceiling
 * is part of the body, so it moves with the sprocket rather than with the road
 * wheels, and left where it was it would hold a tipped belt down to the shape
 * the hull had before it tipped.
 */
export function tipCeiling(
  profile: number[][],
  pitch: number,
  centre: THREE.Vector3,
): number[][] {
  if (pitch === 0) return profile;
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  return profile.map(([z, y]) => {
    const dz = z! - centre.z;
    const dy = y! - centre.y;
    return [centre.z + dy * sin + dz * cos, centre.y + dy * cos - dz * sin];
  });
}

/**
 * Hold a band down to where the ribbon says the belt runs.
 *
 * **Never below a wheel, which is what makes this safe to apply everywhere.** A
 * guide can hold a belt down between its wheels and it cannot pull it inside
 * one, so the ceiling at any z is the higher of the ribbon and the wheel
 * circles there. That is not a guard bolted on: it is what keeps the wraps
 * intact at both ends, where the mirror's ray crosses the ribbon's end cap
 * rather than a run and the reading is worth nothing.
 *
 * The band comes in as a closed loop in the vehicle's space, all on one plane,
 * and goes out the same way, so the belt laid along it needs to know nothing
 * about any of this.
 */
export function holdDown(
  band: number[][],
  profile: number[][],
  wheels: CeilingWheel[],
): number[][] {
  if (band.length < 3 || profile.length < 2) return band;
  // Nothing is added above the reading: the mirror's clustering threshold used
  // to be carried here as a margin against a run coming out scalloped, and
  // measuring it showed the deepest sag it prevents is under 5 mm while the
  // margin itself held the belt a constant 20 mm outside the surface the game
  // draws it against.
  const held = (z: number): number | null => {
    const ribbon = profileAt(profile, z);
    if (ribbon === null) return null;
    const wheel = wheelsAt(wheels, z);
    return wheel !== null && wheel > ribbon ? wheel : ribbon;
  };
  /** How far a point stands over the ceiling, or nothing where there is none. */
  const over = (point: number[]): number => {
    const limit = held(point[2]!);
    return limit === null ? 0 : point[1]! - limit;
  };
  const x = band[0]![0]!;
  // **A vertex wherever the ribbon changes slope.** One edge of the band can
  // span several of them, and across such an edge the two shapes may cross
  // twice, which a test taken at the ends alone reads as no crossing at all.
  // Subdivided first, every edge spans one straight stretch of ribbon and the
  // single crossing solved for below is the only one there is. The breaks that
  // land on the bottom run are collinear and carry nothing.
  const breaks = profile.slice(1, -1).map(([z]) => z!);
  const dense: number[][] = [];
  for (let i = 0; i < band.length; i++) {
    const here = band[i]!;
    const next = band[(i + 1) % band.length]!;
    dense.push(here);
    const span = next[2]! - here[2]!;
    if (span === 0) continue;
    const inside = breaks
      .filter((z) => (z - here[2]!) * (z - next[2]!) < 0)
      .sort((a, b) => (span > 0 ? a - b : b - a));
    for (const z of inside) {
      const t = (z - here[2]!) / span;
      dense.push([x, here[1]! + (next[1]! - here[1]!) * t, z]);
    }
  }
  // **Tested after the subdivision, never before it.** A taut band carries a
  // vertex only where it touches a wheel, so a straight top run spanning the
  // whole vehicle is two points, both of them sitting on an end wheel where
  // the ceiling is high too. Asked of those two alone, a band running 400 mm
  // over the middle of its own ribbon answers that nothing is over anything.
  if (!dense.some((point) => over(point) > 0)) return band;

  const out: number[][] = [];
  const keep = (point: number[]) => {
    const last = out[out.length - 1];
    if (last && Math.hypot(point[2]! - last[2]!, point[1]! - last[1]!) < APART) return;
    out.push(point);
  };
  /** Where the ceiling crosses the segment between two points. */
  const crossing = (a: number[], b: number[]): number[] => {
    const from = over(a);
    const to = over(b);
    const span = from - to;
    // Clamped, because the ceiling carries a wheel's arc as well as the
    // ribbon's straight stretches and an arc is not linear along an edge.
    const t = Math.abs(span) < 1e-9 ? 0 : Math.max(0, Math.min(1, from / span));
    const z = a[2]! + (b[2]! - a[2]!) * t;
    const limit = held(z);
    return [x, limit ?? a[1]! + (b[1]! - a[1]!) * t, z];
  };

  for (let i = 0; i < dense.length; i++) {
    const here = dense[i]!;
    const next = dense[(i + 1) % dense.length]!;
    const standing = over(here) > 0;
    const rising = over(next) > 0;
    // A point over the ceiling is pulled down onto it rather than dropped: the
    // subdivision above already put a vertex at every corner the ribbon turns
    // at, so pulling each one down reproduces the ribbon's own shape and keeps
    // the band's spacing along the rest of the loop.
    keep(standing ? [x, here[1]! - over(here), here[2]!] : here);
    // And the corner where the two shapes meet, which neither of them carries:
    // without it the belt cuts a chord from the last point under the ceiling
    // straight to the first one on it.
    if (standing !== rising) keep(crossing(here, next));
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 2 && first && last && Math.hypot(first[2]! - last[2]!, first[1]! - last[1]!) < APART)
    out.pop();
  return out.length >= 3 ? out : band;
}
