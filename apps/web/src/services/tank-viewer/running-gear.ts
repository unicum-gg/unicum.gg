// The running gear: the wheels, the arms they hang from, and the belt that goes
// round them.
//
// Lifted out of the loader because it is one mechanism rather than three. A
// wheel bolted to the body both travels with the body and spins with the
// ground; an arm holds its wheel against the ground while the body pivots over
// it; and the belt is the answer to where both of those ended up. Written
// separately, each of the three overwrote the last.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import { switched } from "./switches";
import type { MirrorModel } from "@unicum.gg/wargaming";
import { bandAround, type layTrack } from "./track";

/** `Object3D` carries no discriminant, so the renderer's own flag narrows a traversal. */
const isBone = (o: THREE.Object3D): o is THREE.Bone =>
  (o as THREE.Bone).isBone === true;

/** `?wheels=off` stops the wheels turning, for looking at the belt on its own. */
const turnWheels = () => switched("wheels") !== "off";

/** A belt already laid along a path, tagged with the side it runs down. */
export type LaidBelt = ReturnType<typeof layTrack> & { sign: number };

type Wheel = {
  bone: THREE.Bone;
  axle: THREE.Vector3;
  rest: THREE.Matrix4;
  radius: number;
  /** The circle the belt runs on around it, which is not always its rim. */
  wrap: number;
  /**
   * Whether an arm carries it, which is what decides who it follows.
   *
   * A wheel on an arm is held against the ground and stays where the ground put
   * it. Every other one is bolted to the body, so it goes wherever the body
   * goes: on a vehicle that aims by tipping, the sprocket and the idler travel
   * with the hull and the road wheels do not, and that difference is the whole
   * shape of what the belt does.
   */
  carried: boolean;
};

/**
 * Read the running gear off a built vehicle and give back the two things that
 * drive it: how far it has rolled, and how far its body is tipped.
 */
export function runningGear({
  model,
  parts,
  belts,
}: {
  model: MirrorModel;
  parts: THREE.Object3D[];
  belts: LaidBelt[];
}) {
  // Read once per vehicle rather than per frame, and after the module is loaded
  // rather than while it is being imported.
  const turning = turnWheels();
  // Turning the road wheels is what the skeleton in the .glb is there for.
  //
  // The bone a wheel is skinned to sits at the origin, so turning it on its own
  // spins the wheel around the middle of the tank. The mirror publishes where
  // each axle really is and how wide the wheel is around it, both read from the
  // wheel's own vertices, and the turn is made about that point: move to the
  // axle, rotate, move back.
  const bones = new Map<string, THREE.Bone>();
  for (const part of parts)
    part.traverse((o) => {
      if (isBone(o)) bones.set(o.name, o);
    });
  const wheels: Wheel[] = [];
  for (const wheel of model.wheels ?? []) {
    const bone = bones.get(wheel.bone);
    if (!bone) continue;
    wheels.push({
      bone,
      axle: new THREE.Vector3().fromArray(wheel.axle),
      // The client's bones carry a flip of Z, and the bind undoes it, so the
      // rest transform is not the identity. The turn has to be applied in the
      // piece's space, which means in front of it rather than after it.
      rest: bone.matrix.clone(),
      // The rim travels with the belt, so a metre of belt is a metre of rim and
      // the angle that buys is the metre over the radius.
      radius: Math.max(0.05, wheel.radius ?? 0.05),
      wrap: wheel.wrap ?? wheel.radius ?? 0.05,
      carried: false,
    });
  }

  /**
   * The arms a levered suspension hangs its wheels from.
   *
   * Kept beside the wheels and read the same way: the hinge and the wheel it
   * carries come off the mirror, and the bone's rest transform is what the
   * swing has to be applied in front of.
   */
  // **What the chassis says stays on the ground.** An arm is only needed to draw
  // one swinging; two vehicles declare twelve and bind geometry to none, and
  // read from the arms alone they came out with every wheel bolted to the body.
  const grounded = new Set(model.carried ?? []);
  for (const wheel of wheels)
    if (grounded.has(wheel.bone.name)) wheel.carried = true;

  const levers: {
    bone: THREE.Object3D;
    pivot: THREE.Vector3;
    wheel: THREE.Vector3;
    rest: THREE.Matrix4;
  }[] = [];
  for (const lever of model.levers ?? []) {
    const bone = bones.get(lever.bone);
    const carried = wheels.find((w) => w.bone.name === lever.wheel);
    if (!bone || !carried) continue;
    carried.carried = true;
    levers.push({
      bone,
      pivot: new THREE.Vector3().fromArray(lever.pivot),
      wheel: carried.axle.clone(),
      rest: bone.matrix.clone(),
    });
  }
  /**
   * **A belt that answers to its wheels, because it is made of links.**
   *
   * This was tried first on the ribbon the chassis carries, and a ribbon cannot
   * do it: every one of its 810 vertices is bound to a single bone at full
   * weight, 563 of them to the same one, so there is nothing to blend and
   * moving any part of it opens a hard tear. The client does not deform it
   * either. What it does instead is written on the chassis: `physicalTracks`
   * counts the links, names the one model they are made of and lists the wheels
   * they run on, and the game simulates that chain rather than skinning a band.
   *
   * So the belt here is that chain, laid on the taut band around the wheels,
   * and following the suspension is then not a deformation at all: the wheels
   * move, the band is what a belt round them makes, and the same links are
   * spread along it again. Nothing can tear, because nothing is joined.
   */
  let kneelAt = 0;
  let kneelCentre = new THREE.Vector3();
  let travelled = 0;
  /** How far the band was last built, so it is only rebuilt when it moves. */
  // Starts level, so a vehicle at rest keeps the path the mirror published
  // and only a tank that actually tips pays for a rebuild.
  /**
   * The tip the belt was last shaped for, or null while it has never been.
   *
   * **Null and not zero.** Nothing but a tip used to rebuild it, and a tank at
   * rest is tipped by nothing, so at rest the belt was never rebuilt at all: it
   * stayed on the path the client publishes, which runs through the sprocket
   * and the return rollers on the vehicles whose path is drawn badly. The band
   * is the answer everywhere, not only once a tank has knelt.
   */
  let banded: number | null = null;

  /**
   * Where a wheel stands once the body has tipped.
   *
   * The belt is drawn in the chassis's frame, which holds still, so a wheel
   * bolted to the body appears to travel and a wheel on an arm does not. That
   * is the right way round: the arm is what holds its wheel against ground the
   * body is pivoting over.
   */
  const standing = (wheel: Wheel) => {
    if (wheel.carried || kneelAt === 0) return wheel.axle;
    const from = wheel.axle.clone().sub(kneelCentre);
    const cos = Math.cos(kneelAt);
    const sin = Math.sin(kneelAt);
    return new THREE.Vector3(
      wheel.axle.x,
      kneelCentre.y + from.y * cos - from.z * sin,
      kneelCentre.z + from.y * sin + from.z * cos,
    );
  };

  const bandFor = (sign: number) => {
    const side = wheels.filter((w) => Math.sign(w.axle.x) === sign);
    if (side.length < 2) return null;
    // The belt rides on the road wheels, so their plane is its plane.
    const widest = side.reduce((big, w) => (w.wrap > big.wrap ? w : big));
    return bandAround(
      side.map((w) => ({ axle: standing(w), wrap: w.wrap })),
      widest.axle.x,
    );
  };

  const swing = new THREE.Matrix4();
  const swingTo = new THREE.Matrix4();
  const swingFrom = new THREE.Matrix4();
  const toAxle = new THREE.Matrix4();
  const fromAxle = new THREE.Matrix4();
  const turn = new THREE.Matrix4();
  const tip = new THREE.Matrix4();
  const tipTo = new THREE.Matrix4();
  const tipFrom = new THREE.Matrix4();
  const hinge = new THREE.Vector3();
  const moved = new THREE.Vector3();

  const settle = (bone: THREE.Object3D) =>
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);

  /**
   * Put the running gear where the tank being aimed and driven this far puts it.
   *
   * One function rather than two because the two answers are not independent: a
   * wheel bolted to the body both travels with the body and spins with the
   * ground, and its bone can only be written once. Splitting them meant
   * whichever ran second overwrote the first.
   *
   * **The wheels do not move and the hull does.** A tank aiming this way is
   * standing still on its tracks and pushing its own body up at one end, so
   * what changes is the angle between each arm and the hull it hangs from: the
   * hinge travels with the hull, the wheel stays where the ground put it, and
   * the arm makes up the difference. Turning the arms by the pitch itself would
   * swing the wheels off the ground with the body, which is a tank rolling over
   * rather than one taking aim.
   */
  const pose = () => {
    const cos = Math.cos(kneelAt);
    const sin = Math.sin(kneelAt);
    // The body's own rigid motion, which everything bolted to it shares.
    tipTo.makeTranslation(kneelCentre.x, kneelCentre.y, kneelCentre.z);
    tipFrom.makeTranslation(-kneelCentre.x, -kneelCentre.y, -kneelCentre.z);
    tip.makeRotationX(kneelAt).premultiply(tipTo).multiply(tipFrom);
    for (const lever of levers) {
      // Where the hinge ends up once the hull has tipped under it.
      hinge.copy(lever.pivot).sub(kneelCentre);
      moved.set(
        lever.pivot.x,
        kneelCentre.y + hinge.y * cos - hinge.z * sin,
        kneelCentre.z + hinge.y * sin + hinge.z * cos,
      );
      // Where the arm points now, and where it has to point once its hinge has
      // moved and the wheel has not. Turning about X adds to the angle
      // `atan2(z, y)` reads, so the swing is the second less the first: the
      // other way round tips every arm by twice the error.
      const before = Math.atan2(
        lever.wheel.z - lever.pivot.z,
        lever.wheel.y - lever.pivot.y,
      );
      const after = Math.atan2(
        lever.wheel.z - moved.z,
        lever.wheel.y - moved.y,
      );
      swingTo.makeTranslation(moved.x, moved.y, moved.z);
      swingFrom.makeTranslation(-lever.pivot.x, -lever.pivot.y, -lever.pivot.z);
      swing.makeRotationX(after - before);
      lever.bone.matrix
        .copy(swingTo)
        .multiply(swing)
        .multiply(swingFrom)
        .multiply(lever.rest);
      settle(lever.bone);
    }

    for (const wheel of wheels) {
      // Skinning applies `bone.matrixWorld * boneInverse` to a vertex, and at
      // rest those two cancel exactly. To turn the wheel about its axle the
      // product has to become `T(axle) · R · T(-axle)`, so the bone's own
      // matrix is that, followed by its rest transform to undo the inverse.
      toAxle.makeTranslation(wheel.axle.x, wheel.axle.y, wheel.axle.z);
      fromAxle.makeTranslation(-wheel.axle.x, -wheel.axle.y, -wheel.axle.z);
      // `?wheels=off` stops them spinning, and stops nothing else: a wheel the
      // body carries still has to travel with it.
      turn.makeRotationX(turning ? travelled / wheel.radius : 0);
      wheel.bone.matrix
        .copy(toAxle)
        .multiply(turn)
        .multiply(fromAxle)
        .multiply(wheel.rest);
      // A wheel the body carries goes where the body goes, in front of its own
      // spin: the sprocket and the idler ride up with the nose while the road
      // wheels stay planted, which is the shape the belt has to take up.
      if (!wheel.carried && kneelAt !== 0) wheel.bone.matrix.premultiply(tip);
      settle(wheel.bone);
    }

    // The belt last, because it is the answer to where everything else ended
    // up. Rebuilt only when the tank has actually tipped: rolling moves the
    // links along a band that has not changed.
    if (banded !== kneelAt) {
      banded = kneelAt;
      const bands = new Map<number, number[][]>();
      for (const belt of belts) {
        if (!bands.has(belt.sign))
          bands.set(belt.sign, bandFor(belt.sign) ?? []);
      }
      for (const belt of belts) {
        const band = bands.get(belt.sign);
        if (band && band.length >= 3) belt.reshape(band, 0);
      }
    }
    for (const belt of belts)
      belt.place(((travelled % belt.total) + belt.total) % belt.total);
  };

  // **Shaped once before anything asks it to move.** The belt is rebuilt from
  // wherever the wheels ended up, and the wheels are where they are the moment
  // this is built: a vehicle whose tracks a reader has stopped never rolls and
  // never kneels, and would otherwise keep the client's path for good.
  pose();

  return {
    /** Whether this vehicle published axles for its wheels. */
    turns: wheels.length > 0,
    /**
     * Whether the gear has anything to do when the body tips.
     *
     * Not only the arms: a vehicle that draws none still has to carry its
     * sprocket and its rollers up with the hull while its road wheels stay on
     * the ground, and reading this off the arms alone left those frozen.
     */
    kneels: levers.length > 0 || wheels.some((w) => w.carried),
    /** Tip the body by `pitch` radians about `centre`, and settle the gear under it. */
    kneel(pitch: number, centre: THREE.Vector3) {
      if (pitch === kneelAt && centre.equals(kneelCentre)) return;
      kneelAt = pitch;
      kneelCentre = centre.clone();
      pose();
    },
    /**
     * Run the gear as though the tank had travelled this far.
     *
     * A metre travelled is a metre of rim, so each wheel turns that metre over
     * its own radius and the small ones spin faster than the road wheels, as
     * they should. The belt slides the same metre along its path.
     */
    roll(distance: number) {
      travelled = distance;
      pose();
    },
  };
}
