"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Collision } from "@/services/tank-viewer/armour/plates";
import type { VehicleModeKind } from "@unicum.gg/shared";
import type { Sweep } from "@/components/tanks/detail/viewer/aiming";
import type { Aim, Watch } from "@/components/tanks/detail/viewer/aim-dial";
import { modeKindFor } from "@/components/tanks/detail/mode-marks";

/**
 * How long the dial waits before it says where the gun ended up.
 *
 * A drag is a stream of positions and the picture follows every one of them,
 * but the shared link and the readout only want where it came to rest: written
 * live they made a history entry per frame and re-rendered the page under the
 * reader's hand.
 */
const AIM_SETTLE = 250;

// Where the gun is pointed, and everything that decides what it may do.
//
// **What the vehicle can do is not one pair of angles.** A gun's travel varies
// with the bearing, a hull that kneels adds its own, and a vehicle that plants
// itself has a second set of all of it. The picture, the dial and the readout
// all have to agree on which set is in force, so the answer is kept once, here,
// rather than derived three times.

export function useHeroAim({
  deployed,
  mechanic,
  engage,
}: {
  /** Whether the vehicle is in its second state. */
  deployed: boolean;
  /** Which mechanic that state is, since it names the mode the page engages. */
  mechanic?: string | null;
  engage: (kind: VehicleModeKind | null) => void;
}) {
  const aim = useRef<Aim | null>(null);
  /**
   * Tell the draw loop something changed, from outside it.
   *
   * The loop paints only what has moved, and it can see the camera and the
   * tracks for itself. What it cannot see is a reader pointing the gun or
   * planting the tank: those are written into refs it reads, and a ref changing
   * is not an event.
   */
  const nudge = useRef<((ms?: number) => void) | null>(null);
  /** And where the reader is standing, which the dial marks with a camera. */
  const watch = useRef<Watch | null>(null);
  /**
   * Where the gun is being asked to point, read by the draw loop.
   *
   * A ref rather than state: the vehicle answers a pointer at the frame rate,
   * and re-rendering the picture's chrome to turn a turret two degrees would
   * pay for the whole hero on every mouse move.
   */
  const pointing = useRef<{ bearing: number; pitch: number } | null>(null);
  /** What the mounted gun does on its own, before the hull helps. */
  const gunRange = useRef<[number, number]>([0, 0]);
  /** Whether this vehicle aims by turning and kneeling its whole body. */
  const kneels = useRef(false);
  /** What the mounted gun can do, once the vehicle has been read. */
  const [reach, setReach] = useState<{
    sweep?: Sweep;
    arc?: number[];
    hullPitch?: number[] | null;
  } | null>(null);
  /** How far the hull tips, once deployed, or null while it drives. */
  const hullRange = useRef<number[] | null>(null);
  /** The gun's rest angle in its turret, in radians. Zero on a level ring. */
  const joint = useRef(0);
  /** What the gun can do at each bearing, which is not one pair. */
  const runs = useRef<Sweep | undefined>(undefined);
  /**
   * What the gun can swing through, in degrees either side of straight ahead.
   *
   * Published per gun by the client, `[-10, 10]` on the ISU-130 and `[-5, 5]`
   * on the SDP wz. 58T. A gun with no entry turns all the way round.
   */
  const arc = useRef<[number, number] | null>(null);
  const deployedRef = useRef(deployed);
  /** Whether this vehicle has anything to deploy into. */
  const [canDeploy, setCanDeploy] = useState(false);
  /** Both of the vehicle's aiming states, and which gun is mounted. */
  const stance = useRef<{
    travel: Collision["mounts"] | null;
    siege: NonNullable<Collision["mounts"]>["siege"];
    gun: string;
  } | null>(null);
  /**
   * Point the viewer at the state the reader has chosen.
   *
   * Everything that says how the vehicle aims comes from here and nowhere
   * else, so travelling and deployed cannot end up describing one another: the
   * gun's own limits, the arc it swings through, the runs the dial draws, and
   * how far the suspension tips.
   */
  const applyStance = useCallback(() => {
    nudge.current?.();
    const both = stance.current;
    if (!both) return;
    const now = (deployedRef.current && both.siege) || both.travel;
    const gun = both.gun;
    gunRange.current = (now?.pitch?.[gun] as [number, number] | undefined) ?? [
      0, 0,
    ];
    runs.current = now?.sweep?.[gun] as Sweep | undefined;
    hullRange.current = now?.hullPitch ?? null;
    kneels.current = now?.hullPitch != null;
    const swing = now?.yaw?.[gun];
    arc.current = (swing as [number, number] | undefined) ?? null;
    setReach({
      sweep: now?.sweep?.[gun] as Sweep | undefined,
      arc: swing,
      hullPitch: now?.hullPitch ?? null,
    });
  }, []);
  /** Plant the vehicle, or pick it back up. */
  const setDeploy = useCallback(
    (on: boolean) => engage(on ? modeKindFor(mechanic ?? null) : null),
    [engage, mechanic],
  );
  // The pose follows the shared state whichever end set it, so the switch below
  // the picture moves the vehicle in it.
  useEffect(() => {
    if (deployedRef.current === deployed) return;
    deployedRef.current = deployed;
    applyStance();
  }, [deployed, applyStance]);
  /**
   * Where the gun has been pointed, kept for the link as well as the picture.
   *
   * **Held still until the hand stops.** The picture takes every move through
   * refs and costs nothing, but this is state, and state here reaches the
   * configurator, which re-encodes the setup and writes it into the URL: a
   * drag round the dial was 120 history writes and ran at 177ms a frame, which
   * is the whole page re-rendering under a moving finger. A quarter second of
   * quiet is far below what anyone would call a delay on a link, and the aim
   * itself never waits.
   */
  const [aimed, setAimed] = useState<{ bearing: number; pitch: number } | null>(
    null,
  );
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (settling.current) clearTimeout(settling.current);
  }, []);
  const takeAim = useCallback((bearing: number, pitch: number) => {
    nudge.current?.();
    pointing.current = { bearing, pitch };
    aim.current?.(bearing, pitch);
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => setAimed({ bearing, pitch }), AIM_SETTLE);
  }, []);
  /**
   * Put the gun back to level, and forget where it was going.
   *
   * **The timer has to go with it.** A reset is one of the things that can
   * happen inside the quarter second the dial waits before publishing, and
   * clearing the state without clearing the timer meant the aim came back on
   * its own a moment later: the Reset button stayed lit for a view nobody had
   * moved, and the shared link described a gun that was pointing straight
   * ahead. The hull-down path made it certain rather than likely, since putting
   * the vehicle back on level ground aims the gun and undoes it on the next
   * line.
   */
  const restAim = useCallback(() => {
    if (settling.current) clearTimeout(settling.current);
    settling.current = null;
    pointing.current = null;
    setAimed(null);
  }, []);
  /**
   * The parts of it the picture is handed, as one object that never changes.
   *
   * **The scene is rebuilt whenever what it was opened with changes**, so what
   * it is opened with cannot be an object rebuilt every render: naming the
   * whole hook there tore the vehicle down and fetched it again on every
   * keystroke in the page. These are all refs and state setters, which React
   * keeps for the life of the component, so one memo holds them for good.
   */
  const handles = useMemo(
    () => ({
      aim,
      arc,
      gunRange,
      hullRange,
      joint,
      nudge,
      pointing,
      runs,
      stance,
      watch,
      restAim,
      setCanDeploy,
    }),
    // `restAim` is a callback over refs and so is fixed too, but eslint cannot
    // see that through the hook, and a memo that rebuilt would rebuild the
    // vehicle with it.
    [restAim],
  );
  return {
    handles,
    restAim,
    aim,
    watch,
    nudge,
    pointing,
    gunRange,
    kneels,
    hullRange,
    joint,
    runs,
    arc,
    stance,
    applyStance,
    takeAim,
    setDeploy,
    deployedRef,
    reach,
    setReach,
    aimed,
    setAimed,
    canDeploy,
    setCanDeploy,
    settling,
  };
}
