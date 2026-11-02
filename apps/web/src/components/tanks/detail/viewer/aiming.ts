import type * as Three from "three";

// What a gun can do, in the terms the diagram draws.
//
// Its own module because both the viewer and the diagram need it, and the
// diagram is rendered by the viewer: a reading that lived in either would have
// to import what imports it.

/** The runs the mirror publishes, `(bearing, degrees)` with bearing in turns. */
export type Sweep = { up: number[][]; down: number[][] };

/**
 * How far the gun goes at one bearing, **counted up from level**.
 *
 * So a gun that drops 8 and lifts 15 reads `lo -8, hi 15`. One scale rather
 * than two magnitudes, because that is what the dial puts a radius on: the
 * picture is the ground seen from above, and a muzzle pointed down meets it
 * close in while one pointed up reaches away.
 *
 * The client counts the other way, down positive, so the runs are turned over
 * here and nowhere else.
 */
export type Reach = { lo: number; hi: number };

/**
 * Read a run at one bearing, sloping between the points it names.
 *
 * The client writes a limit as `(bearing, degrees)` and repeats the value at
 * both ends of every stretch it means to be flat, so a flat stretch comes out
 * flat on its own and the slope between two different points is the shoulder
 * where the hull starts getting in the way.
 */
function at(run: number[][], turn: number): number {
  if (run.length === 0) return 0;
  const wrapped = ((turn % 1) + 1) % 1;
  for (let i = 0; i < run.length; i++) {
    const [from, value] = run[i] as [number, number];
    const next = run[i + 1];
    if (!next) return value;
    const [to, ahead] = next as [number, number];
    if (wrapped >= from && wrapped < to) {
      const span = to - from;
      return span <= 0 ? value : value + ((wrapped - from) / span) * (ahead - value);
    }
  }
  return (run[run.length - 1] as [number, number])[1];
}

/** What the gun reaches at this bearing, in degrees up from level. */
export function reachAt(sweep: Sweep | undefined, bearing: number): Reach {
  if (!sweep) return { lo: 0, hi: 0 };
  return { lo: -at(sweep.down, bearing), hi: -at(sweep.up, bearing) };
}

/** Where the reader has pointed, in the dial's own units. */
export type Pointed = { bearing: number; pitch: number };

/** What this vehicle is allowed to do with the aim it is given. */
export type Limits = {
  /** The gun's own travel as `[-elevation, +depression]`, the client's order. */
  gun: [number, number];
  /** What it can reach at each bearing, where the client says it varies. */
  sweep: Sweep | undefined;
  /** How far the hull itself tips, on the vehicles that aim that way. */
  hull: number[] | null;
  /** The angle the turret ring is mounted at, which the joint cancels. */
  joint: number;
  /** How far the gun swings either side of straight ahead, where it is limited. */
  arc: [number, number] | null;
};

/** The groups the pose is written onto. */
export type Aimed = {
  gun: Three.Object3D;
  turret: Three.Object3D;
  pivot: Three.Object3D;
  /** The whole tank, which turns on the spot for what the gun cannot reach. */
  vehicle: Three.Object3D;
};

/**
 * How a bearing is shared between the gun and the vehicle under it.
 *
 * **A gun that cannot reach a bearing does not mean the vehicle cannot.** The
 * client publishes the arc the gun itself sweeps, three degrees either way on
 * the Strv 103B and ten on the ISU-130, and past that the player turns the
 * tank. Left to the gun alone the dial accepted a bearing of ninety degrees and
 * the picture did not move at all, which is the viewer refusing to show the one
 * mechanism those vehicles aim with.
 *
 * A turret that goes all the way round takes the whole bearing and leaves the
 * vehicle nothing, so this is the same answer it always gave for everything
 * else.
 *
 * Exported because the dial draws the same two angles: what turns on the glyph
 * has to be what turns in the picture.
 */
export function yawShare(
  bearing: number,
  arc: [number, number] | number[] | null | undefined,
): { gun: number; body: number } {
  // Normalised into degrees either side of straight ahead first: the dial
  // counts a whole turn from zero, so the last few degrees before it comes
  // round are a small negative angle rather than a large positive one, and
  // clamping the raw fraction pinned every gun to one end of its arc.
  const asked = ((((bearing * 360) % 360) + 540) % 360) - 180;
  const gun = arc ? Math.max(arc[0]!, Math.min(arc[1]!, asked)) : asked;
  return { gun, body: asked - gun };
}

/**
 * Point the vehicle where the dial says, within what it can actually do.
 *
 * **The gun aims first and the hull makes up what is left**, which is the order
 * the client puts them in and the reason this is one function rather than three:
 * the three answers are not independent, and computing them apart is how a
 * deployed vehicle ends up tipped four times as far as its suspension travels.
 */
export function aimAt(
  pointed: Pointed,
  limits: Limits,
  parts: Aimed,
  kneel?: (angle: number, at: Three.Vector3) => void,
): void {
  // The dial counts pitch up from level and turning about X swings the
  // muzzle down, so the one is the other's negative.
  const wanted = (-pointed.pitch * Math.PI) / 180;
  // **The gun aims first, and the hull makes up what is left.** That is
  // the order the client puts them in: a deployed Kunze Panzer still
  // elevates its own fifteen degrees and its body adds five, so giving
  // the whole twenty to the body tips it four times as far as it can
  // go. The Strv reads the same way and comes out looking unchanged,
  // because its gun is pinned at a degree and the body does the rest.
  //
  // `pitch` is `[-elevation, +depression]` the way the client writes
  // it, so the two ends are not one number.
  // **At this bearing, not at the gun's best.** The runs are what say a
  // gun cannot look down over its own engine deck, and the widest pair
  // is only their envelope. On a vehicle that aims with its hull the
  // difference shows: the dial offers the gun's reach plus the hull's,
  // the gun helps itself first, and taking its best rather than what it
  // has here puts the barrel through the deck at the back.
  const own = limits.gun;
  // Turned over into the dial's own counting, the way `reachAt` does it: the
  // client writes `[-elevation, +depression]` and a `Reach` counts up from
  // level, so the depression is the low end and the elevation the high one.
  // Written the other way round, a vehicle whose collision file publishes no
  // runs was clamped into a band that only ever pointed down.
  const here = limits.sweep
    ? reachAt(limits.sweep, pointed.bearing)
    : { lo: -own[1], hi: -own[0] };
  const reachable = (angle: number) =>
    Math.max((-here.hi * Math.PI) / 180, Math.min((-here.lo * Math.PI) / 180, angle));
  const tips = limits.hull;
  const tipped = (angle: number) =>
    tips
      ? Math.max((-tips[1] * Math.PI) / 180, Math.min((-tips[0] * Math.PI) / 180, angle))
      : 0;
  // **The gun takes what it can reach, and a bolted-on gun reaches nothing.**
  // A deployed Kunze Panzer elevates its own fifteen degrees and its body adds
  // five, and giving the whole twenty to the body tips it four times as far as
  // it can go. The Strv 103B's gun is published with no range of its own at
  // all, so the same line clamps it to zero and the suspension does every
  // degree: no branch, because the two are the same rule read off the same
  // numbers.
  const byGun = reachable(wanted);
  // The joint the turret hangs the gun on, which is what keeps it level
  // at rest on a ring that is not.
  parts.gun.rotation.x = limits.joint + byGun;
  // **The hull tips, the tracks stay down.** The suspension kneels the
  // body on its wheels; rotating the whole vehicle instead would drive
  // its own tracks into the floor at one end and lift them at the
  // other, which is a tank falling over rather than aiming.
  //
  // Clamped to what the suspension actually travels. Left open it took
  // whatever the gun could not, which on a vehicle with a real gun is
  // most of the aim.
  const kneeling = tipped(wanted - byGun);
  parts.pivot.rotation.x = kneeling;
  // And the arms it kneels on swing to keep the wheels where they are.
  if (kneel) kneel(kneeling, parts.pivot.position);
  // **The gun swings as far as it can, and the vehicle turns for the rest.**
  //
  // That is the mechanism those vehicles aim with: the client publishes the
  // arc the gun itself sweeps, three degrees either way on the Strv 103B and
  // ten on the ISU-130, and past that the player turns the tank. Refusing the
  // rest was tried and is worse than it sounds: the dial accepted a bearing of
  // ninety degrees, reported it, and the picture was identical to the one
  // before, because the three degrees the gun could give are invisible.
  //
  // The vehicle rather than the hull, so the running gear and the belt come
  // round with it rather than being left behind, and on its own group rather
  // than on the one that kneels, so a turn and a kneel stay independent.
  const { gun: swept, body: turned } = yawShare(pointed.bearing, limits.arc);
  parts.turret.rotation.y = (swept * Math.PI) / 180;
  parts.vehicle.rotation.y = (turned * Math.PI) / 180;
}
