import type * as Three from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { AZIMUTH, DISTANCE, ELEVATION } from "@/components/tanks/detail/viewer/framing";
import { Cinematic, CINEMATIC_WAIT } from "@/components/tanks/detail/viewer/cinematic";
import { drifting } from "@/services/tank-viewer/idle";

// Where the camera stands, and everything that moves it on its own.
//
// **One owner for a camera with three minds.** The reader drags it, the page
// sends it places, and left alone it wanders; each of those has to give way to
// the ones above it, and the rules for that are the whole of this file. Kept
// with the state they act on rather than spread through the render loop, which
// is where they were and where a fourth would have gone.
export type Rig = {
  /** How far the frame has travelled from the hero's anchor to the middle. */
  readonly centring: number;
  /** Whether the vehicle is being held in the middle rather than off to a side. */
  readonly framed: boolean;
  /** The framing this vehicle was fitted to, for anything offering it back. */
  readonly home: Three.Vector3;
  readonly homeTarget: Three.Vector3;
  /** Send the camera somewhere over the travel beat rather than cutting to it. */
  travel(to: { centring?: number; position?: Three.Vector3; target?: Three.Vector3 }): void;
  /** Put the frame back where the vehicle was fitted. */
  reset(): void;
  /** Bring the vehicle to the middle of the band, or let it back to the side. */
  recentre(on?: boolean): void;
  /** How long the camera waits before it starts wandering, if it does. */
  cinema(mode: Cinematic): void;
  /**
   * Carry the camera one frame forward.
   *
   * Says what moved so the loop can decide whether the picture is worth
   * painting: a journey also reframes the band, which is why it is answered
   * apart from the drift.
   */
  step(seconds: number): { travelling: boolean; drifted: boolean; gliding: boolean };
  /** Where the reader is standing, as a fraction of a turn. */
  bearing(): number;
};

export function rigFor({
  THREE,
  camera,
  controls,
  vehicle,
  turret,
  gun,
  previous,
  centredAtFirst,
  cinematicAtFirst,
  wake,
  setMoved,
  setCentred,
  atRest,
  held,
}: {
  THREE: typeof import("three");
  camera: Three.PerspectiveCamera;
  controls: OrbitControls;
  vehicle: Three.Object3D;
  turret: Three.Object3D;
  gun: Three.Object3D;
  /** Where the vehicle before this one was being seen from, if there was one. */
  previous: { position: number[]; target: number[] } | null;
  centredAtFirst: boolean;
  cinematicAtFirst: Cinematic;
  wake: (ms?: number) => void;
  setMoved: (on: boolean) => void;
  setCentred: (on: boolean) => void;
  /** Put the vehicle itself back, which a reset asks for as well as the frame. */
  atRest: () => void;
  /** Whether the vehicle is being held in a pose the drift must not undo. */
  held: () => boolean;
}): Rig {
  // Framed on the vehicle rather than on a fixed distance, so a scout and a
  // Maus both fill the band.
  //
  // **The gun is left out of the measurement.** A long barrel drags the
  // bounding box a metre to one side, and centring that box shoves the hull
  // the other way: a long-barrelled tank destroyer ends up parked in the
  // corner. The picture this replaces anchors on the vehicle's centre of
  // mass for the same reason, the barrel carrying almost no area, and hull
  // and turret are the cheap way to the same place.
  const withGun = new THREE.Box3().setFromObject(vehicle);
  // Lifted out for the measurement and put straight back: the gun hangs off
  // the turret, so there is no measuring the rest without detaching it.
  turret.remove(gun);
  const bounds = new THREE.Box3().setFromObject(vehicle);
  turret.add(gun);
  const centre = bounds.getCenter(new THREE.Vector3());
  // **Height is measured on the whole vehicle, including the gun.**
  //
  // Leaving the gun out is about the sideways drag a long barrel puts on the
  // box, which is what the paragraph above is for; it was never about
  // height. On a Waffenträger the two are not the same thing: what the
  // client files as the gun is the entire open mount, tall and most of the
  // vehicle's area, so dropping it put the centre down at the hull and the
  // mount left the frame through the top of the hero. A barrel changes this
  // by a few centimetres and a mount by a metre, which is the difference
  // that matters.
  // **Upward only.** Leaving the gun out is about the sideways drag a long
  // barrel puts on the box; height is its own question, and the answer is
  // not the same at both ends. What put the Waffenträger's mount through the
  // top of the hero is the gun reaching *up*, so the top has to count it.
  // What a barrel does at the other end is dip, and counting that drags the
  // centre down and lifts the whole vehicle off its mark: on the Object 140
  // it stood 36 px high against the picture it stands in for.
  centre.y = (bounds.min.y + Math.max(bounds.max.y, withGun.max.y)) / 2;
  // The angle the pipeline's own viewer settles on, and the one an armour
  // model is read from: far enough back that a scout and a Maus both fit,
  // and off to one side so a face and a flank are in view at once. Copied
  // rather than re-chosen, because a hero framed by taste drifts from the
  // thing it is supposed to be showing.
  // Fixed, not fitted: see `DISTANCE`. Nothing is measured off the vehicle
  // here any more, which is the whole point.
  const fit = DISTANCE;
  const towards = new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  controls.target.copy(centre);
  camera.position.copy(centre).addScaledVector(towards, fit);
  controls.update();
  // The hangar drift, on the framing this vehicle was fitted to.
  //
  // **The distance swing is a factor of the fit, not a length.** The game's
  // hangar holds one vehicle at a time at a distance it chose, so its own
  // figures are metres; ours has to sit right for a scout and for a Maus,
  // so the swing is taken as a share of whatever distance the fit landed on.
  // The client's numbers will need the same treatment when they arrive.
  const wander = drifting({
    // Where the wait comes from, and why it is that number, is `cinematic`.
    after: CINEMATIC_WAIT[Cinematic.Auto],
    easingIn: 5,
    yawPeriod: 139,
    // The client's own figures are radians of pitch, counted the way it
    // counts them: -0.5 to -0.08, which is the camera between 28.6 and 4.6
    // degrees above the vehicle. Ours counts elevation the other way round,
    // so the sign turns and the numbers do not.
    pitch: { min: 0.08, max: 0.5, period: 67 },
    // **Its distances are the hangar's, not ours.** The game swings between
    // 7 and 10.7 metres of a camera that starts at 10.7; we stand at the
    // distance WG's own renders imply, which is another number entirely. So
    // what carries over is the ratio, and the dolly covers the same share of
    // the way in that the game's does.
    distance: { min: fit * (7 / 10.7), max: fit, period: 89 },
  });

  // **Off lets go rather than cutting.** The wait alone would leave a drift
  // already under way to run to the end of its own motion, and the coast is
  // the part that reads as a camera rather than as an animation stopping.
  const cinema = (mode: Cinematic) => {
    wander.waitFor(CINEMATIC_WAIT[mode]);
    if (mode === Cinematic.Off) wander.touched();
  };
  // A mode chosen while the vehicle was still loading still counts.
  cinema(cinematicAtFirst);

  // The framing to come back to.
  //
  // Through the controls' own save and restore rather than by putting the
  // camera back: with damping on they keep easing toward wherever the drag
  // was heading, so a camera moved underneath them is dragged off again over
  // the following frames and lands a couple of points from where it started.
  const home = camera.position.clone();
  const homeTarget = controls.target.clone();
  // **Arriving from another tank, the camera travels rather than cuts.**
  // Every vehicle is framed to its own size, so a Maus and a light tank
  // stand at very different distances: dropped straight onto the new
  // framing, the handover ended with the scene jumping. Put back where the
  // last one was and sent home, it reads as the camera moving from one tank
  // to the next, the same way the ridge does.
  if (previous) {
    camera.position.fromArray(previous.position);
    controls.target.fromArray(previous.target);
    // Which is a framing this vehicle did not choose, so the way back to
    // its own is offered.
    setMoved(true);
  }
  // Where the frame stands, kept beside the React state rather than read
  // from it: the controls' callbacks outlive any one render.
  // Seeded from what the reader last asked for, so a vehicle opens framed
  // the way the last one was rather than snapping to the middle a moment
  // after it appears.
  let framed = centredAtFirst;
  // **Back to the vehicle the page opened on, not only the angle it was
  // seen from.** A reader who has pointed the gun down, swung the turret
  // round and put the tank on a ridge has changed the vehicle as much as
  // the camera, and putting the camera back while the barrel stays where
  // they left it is half an undo.
  const resetFrame = () => {
    wake();
    framed = false;
    travel({ centring: 0, position: home, target: homeTarget });
    setMoved(false);
    setCentred(false);
    // The pose first, since leaving it by hand deliberately keeps the gun
    // where it was: this is the one place that is asking for it back.
    atRest();
  };
  // **A toggle, not a one-way trip.** Bringing the vehicle to the middle is
  // a way of looking at it, and anyone who does it wants the hero's framing
  // back afterwards without also losing the angle they turned it to, which
  // is the reset's job and not this one's.
  const recentreFrame = (on?: boolean) => {
    wake();
    framed = on ?? !framed;
    travel({ centring: framed ? 1 : 0 });
    setCentred(framed);
  };
  // **Moved means a hand moved it.** The controls fire `change` for every
  // move, including the ones the page makes itself, so reading the camera's
  // distance from home on its own counted the idle drift as the reader
  // having done something and offered a reset for a view nobody had touched.
  // Only what happens between taking hold and letting go is theirs.
  let handling = false;
  controls.addEventListener("change", () => {
    wake();
    if (handling) setMoved(camera.position.distanceTo(home) > 0.05);
  });
  // A hand on the model outranks a move it did not ask for.
  controls.addEventListener("start", () => {
    handling = true;
    journey = null;
    wander.touched();
    // **The pose ends where the reader takes over.** Hull down is a stance
    // the viewer puts the vehicle in to answer one question, and the answer
    // is over the moment somebody starts turning the tank themselves: the
    // gun would otherwise stay pinned at full depression through every
    // angle they went on to look at, which is a tank nobody is looking at.
    // The camera is left exactly where the hand is taking it.
    atRest();
  });
  controls.addEventListener("end", () => {
    handling = false;
  });

  // How far the frame has travelled from the picture's anchor to the middle
  // of the band: 0 where the vehicle is framed the way the hero wants it,
  // off to the left in perspective, 1 with it brought to the middle. Moving
  // between the two is asked for, never inferred: turning the vehicle is not
  // a request to reframe the page around it. `centring` is where the frame
  // is, `settled` where it is going, and the draw loop closes the gap.
  let centring = 0;

  // **A view that moves on its own has to be followed, not caught up with.**
  //
  // Both controls put the camera somewhere it is not, and arriving in one
  // frame reads as a glitch rather than as a move: the eye loses which way
  // the vehicle was facing and has to find it again on the other side. So
  // the view travels, over a beat long enough to follow and short enough
  // that nobody waits on it, and what it crosses is the whole state at once,
  // the frame's offset and the camera together, so a reset is one movement
  // rather than two things happening at the same time.
  const TRAVEL = 620;
  // Slow at both ends and quickest in the middle, the way a camera on a rig
  // moves. It is what makes the arrival read as a stop rather than as a cut.
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  type Journey = {
    started: number;
    from: {
      centring: number;
      position: Three.Vector3;
      target: Three.Vector3;
    };
    to: {
      centring: number;
      position: Three.Vector3;
      target: Three.Vector3;
    };
  };
  let journey: Journey | null = null;
  const travel = (to: {
    centring?: number;
    position?: Three.Vector3;
    target?: Three.Vector3;
  }) => {
    // The momentum a drag leaves behind is spent first, on one undamped
    // pass: left in, the controls keep easing toward wherever the drag was
    // heading and drag the camera off the path it is being sent along.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    journey = {
      started: performance.now(),
      from: {
        centring,
        position: camera.position.clone(),
        target: controls.target.clone(),
      },
      to: {
        centring: to.centring ?? centring,
        position: (to.position ?? camera.position).clone(),
        target: (to.target ?? controls.target).clone(),
      },
    };
  };
  return {
    get centring() {
      return centring;
    },
    get framed() {
      return framed;
    },
    home,
    homeTarget,
    travel,
    reset: resetFrame,
    recentre: recentreFrame,
    cinema,
    step(seconds) {
      let travelling = false;
      if (journey) {
        const along = Math.min(1, (performance.now() - journey.started) / TRAVEL);
        const at = ease(along);
        const { from, to } = journey;
        centring = from.centring + (to.centring - from.centring) * at;
        camera.position.lerpVectors(from.position, to.position, at);
        controls.target.lerpVectors(from.target, to.target, at);
        travelling = true;
        if (along === 1) journey = null;
      }
      // The camera wanders when it is left alone, and gives way to anything
      // asked for: a journey is a move someone pressed a button for. A pose is
      // one of those, and it holds. The drift only ever pitches above the
      // horizon, so left to run it would climb back over a ridge and undo the
      // stance a few seconds after it was asked for.
      let drifted = false;
      if (!journey && !held()) {
        const offset = camera.position.clone().sub(controls.target);
        const where = new THREE.Spherical().setFromVector3(offset);
        const next = wander.move(seconds, {
          yaw: where.theta,
          // The client counts pitch up from the horizon, three counts it down
          // from straight above.
          pitch: Math.PI / 2 - where.phi,
          distance: where.radius,
        });
        if (next) {
          drifted = true;
          where.theta = next.yaw;
          where.phi = Math.PI / 2 - next.pitch;
          where.radius = next.distance;
          where.makeSafe();
          camera.position
            .copy(controls.target)
            .add(new THREE.Vector3().setFromSpherical(where));
        }
      }
      // `update` says whether it moved the camera itself, which is how the
      // glide after a drag keeps the picture alive without a flag of its own.
      const gliding = controls.update();
      return { travelling, drifted, gliding };
    },
    bearing() {
      return controls.getAzimuthalAngle() / (Math.PI * 2);
    },
  };
}
