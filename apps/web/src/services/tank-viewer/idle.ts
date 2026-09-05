// The camera that wanders when nobody is touching it.
//
// **This is the game's own hangar drift, rule for rule**, read from the client's
// `gui/hangar_cameras/hangar_camera_idle.py`. It is three motions at once, and
// the reason it reads as a camera rather than as an animation is in the details:
//
//  - the yaw turns at a constant rate, one full circle per `yawPeriod`
//  - the pitch and the distance each swing on a sine of their own, between their
//    own limits and on their own period, so the three never line up and the path
//    never repeats where the eye can catch it
//  - each sine starts from **wherever the camera already is**, by solving its
//    phase from the current value, which is why the drift begins without a jump
//  - letting go does not cut: the motion decelerates at a constant rate over
//    exactly 0.8 s, so the camera coasts to a stop the way a rig does
//
// What the client keeps that this does not: the drift there is one of several
// camera behaviours sharing a manager, with sounds and a parallax that follows
// the mouse. This is the drift alone.

/** One value that swings on its own sine, between its own limits. */
export type Swing = {
  min: number;
  max: number;
  /** Seconds for one full swing. Zero or less holds the value still. */
  period: number;
};

/**
 * How far the drift reaches, and how fast.
 *
 * **Read from the client, not chosen.** The rules above come from its scripts,
 * and these come from the `BW::IdleComponent` on the hangar's own camera, in
 * `content/HangarPrefabs/hangar_v4/HeroTank_hangar_v4.prefab`: a full turn every
 * 139 s, a pitch swinging over 67 s between 0.08 and 0.5 radians, a distance
 * swinging over 89 s between 7 and 10.7 metres, and 5 s to come up to speed.
 *
 * The only one that cannot be carried over as it stands is the distance, which
 * is in the hangar's metres rather than ours; the caller passes the same ratio
 * against whatever distance it stands at.
 */
export type Drift = {
  /** Seconds of stillness before the camera starts to wander. */
  after: number;
  /** Seconds the motion takes to come up to speed, from nothing. */
  easingIn: number;
  /** Seconds for one full turn around the vehicle. */
  yawPeriod: number;
  pitch: Swing;
  distance: Swing;
};

/** Slow at the end, which is how a value settles rather than arrives. */
const easeOutQuad = (t: number, change: number, over: number) => {
  const at = t / over;
  return -change * at * (at - 2);
};

/** A frame longer than this is a stall, and moving the full way would jump. */
const MAX_STEP = 0.05;

/** Seconds the camera takes to coast to a stop once it is touched. */
const STOPPING = 0.8;

/** Where the camera is, in the terms the drift moves it in. */
export type Pose = { yaw: number; pitch: number; distance: number };

/**
 * The drift, as something a draw loop can step.
 *
 * It owns no camera and no clock: the caller hands it the time that has passed
 * and the pose the camera is in, and it hands back the pose to be in. That keeps
 * it testable against the client's own figures, and keeps the orbit controls the
 * only thing that ever writes to the camera.
 */
export function drifting(drift: Drift) {
  let idle = 0;
  let still = 0;
  /** The wait in force, which the caller can change without rebuilding this. */
  let wait = drift.after;
  let running = false;
  let stopping = 0;
  /** The phase each sine was entered at, so it begins where the camera was. */
  let pitchAt = 0;
  let distanceAt = 0;
  let from: Pose = { yaw: 0, pitch: 0, distance: 0 };
  /** The rate each value was moving at when it was let go, for the coast. */
  let speed: Pose = { yaw: 0, pitch: 0, distance: 0 };

  /** The phase that makes a sine pass through `value` at t=0. */
  const enterAt = (swing: Swing, value: number) => {
    const span = swing.max - swing.min;
    if (span === 0) return 0;
    const held = Math.min(Math.max(value, swing.min), swing.max);
    return Math.asin(-1 + ((held - swing.min) * 2) / span);
  };

  const sine = (swing: Swing, at: number) =>
    swing.min +
    (swing.max - swing.min) *
      (Math.sin((2 * Math.PI * idle) / swing.period + at) * 0.5 + 0.5);

  const value = (swing: Swing, at: number, start: number) => {
    if (swing.period <= 0) return start;
    if (idle < drift.easingIn) {
      return start + easeOutQuad(idle, sine(swing, at) - start, drift.easingIn);
    }
    return sine(swing, at);
  };

  return {
    /** Whether the camera is wandering, for anything that wants to say so. */
    wandering: () => running,

    /**
     * Change how long the camera must be left alone before it wanders.
     *
     * **The two ends of the wait are the whole of the switch.** Zero starts it
     * the moment the reader lets go, and a wait that never arrives is the drift
     * turned off, so there is nothing else to keep in step with it. What it does
     * not do is stop a drift already running: that is letting go, and letting go
     * is `touched`, which coasts rather than cuts.
     */
    waitFor(seconds: number) {
      wait = seconds;
    },

    /** A hand on the model: the drift lets go and coasts to a stop. */
    touched() {
      still = 0;
      if (running) {
        running = false;
        stopping = 0;
      }
    },

    /**
     * Step the drift by `step` seconds and say where the camera should be, or
     * null while it has nothing to say and the caller should leave the camera
     * where the controls put it.
     */
    move(step: number, now: Pose): Pose | null {
      const dt = Math.min(step, MAX_STEP);
      if (dt <= 0) return null;

      if (!running && stopping >= STOPPING) {
        still += dt;
        if (still < wait) return null;
        // Entering from where the camera stands, so nothing jumps.
        running = true;
        idle = 0;
        from = { ...now };
        pitchAt = enterAt(drift.pitch, now.pitch);
        distanceAt = enterAt(drift.distance, now.distance);
        speed = { yaw: 0, pitch: 0, distance: 0 };
      }

      if (running) {
        idle += dt;
        const ramp = idle > drift.easingIn ? 1 : idle / drift.easingIn;
        const yawStep = drift.yawPeriod > 0 ? ((2 * Math.PI * dt) / drift.yawPeriod) * ramp : 0;
        const next = {
          yaw: now.yaw + yawStep,
          pitch: value(drift.pitch, pitchAt, from.pitch),
          distance: value(drift.distance, distanceAt, from.distance),
        };
        // Kept so the coast can carry on at the rate the drift was going.
        speed = {
          yaw: yawStep / dt,
          pitch: (next.pitch - now.pitch) / dt,
          distance: (next.distance - now.distance) / dt,
        };
        return next;
      }

      // Coasting: a constant deceleration that reaches nothing at `STOPPING`.
      stopping += dt;
      const coast = (was: number, at: number) => {
        const a = -was / STOPPING;
        const v = was + stopping * a;
        return at + v * dt + (a * dt * dt) / 2;
      };
      const next = {
        yaw: coast(speed.yaw, now.yaw),
        pitch: coast(speed.pitch, now.pitch),
        distance: coast(speed.distance, now.distance),
      };
      if (stopping >= STOPPING) still = 0;
      return next;
    },
  };
}
