"use client";

import type { RefObject } from "react";

import type { PaintLock } from "@unicum.gg/shared";

import { buildStage } from "@/components/tanks/detail/viewer/build";
import { heldFrame } from "@/components/tanks/detail/viewer/held-frame";
import { revealVehicle } from "@/components/tanks/detail/viewer/reveal";
import { loadArmour } from "@/services/tank-viewer/armour";
import type { Cinematic } from "@/components/tanks/detail/viewer/cinematic";
import { fitVehicle, type Fitting } from "@/components/tanks/detail/viewer/fitting";
import { VIEW_DISSOLVE } from "@/components/tanks/detail/viewer/framing";
import { inherited, release } from "@/components/tanks/detail/viewer/handover";
import { runStage, type Page } from "@/components/tanks/detail/viewer/loop";
import { mirror } from "@/components/tanks/detail/viewer/mirror";

/**
 * How long the hero waits for the last of a vehicle's textures.
 *
 * Long enough for a cold cache on a tier ten's high-definition set, short
 * enough that a mirror sitting on one bad map costs a reader a pause rather
 * than the picture.
 */
const PATIENCE = 8000;
import { rigFor } from "@/components/tanks/detail/viewer/rig";
import { View } from "@/components/tanks/detail/viewer/views";
import { ArmourView } from "@/services/tank-viewer/armour";
import type { Mounted } from "@/services/tank-viewer";

// Opening a vehicle: the four stages, in the one order they work in.
//
// Build the room and the tank, tell the tank what it is, start the loop, then
// put back whatever the link asked for. Each of those is a file of its own; this
// is what says they happen in that order and hands each one what the last made.

/** What the picture is given, beyond what the stages ask for themselves. */
export type Opening = Fitting &
  Page & {
    canvas: RefObject<HTMLCanvasElement | null>;
    ghost: RefObject<HTMLCanvasElement | null>;
    aim: RefObject<((bearing: number, pitch: number) => void) | null>;
    cine: RefObject<((mode: Cinematic) => void) | null>;
    cinematicRef: RefObject<Cinematic>;
    reset: RefObject<(() => void) | null>;
    nudge: RefObject<((ms?: number) => void) | null>;
    setCrossing: (on: boolean) => void;
    /**
     * A vehicle is standing in the room, which `setShown` no longer means: the
     * canvas is shown as soon as the studio is lit and the tank arrives later.
     */
    setStanding: (on: boolean) => void;
    setMoved: (on: boolean) => void;
    setCentred: (on: boolean) => void;
    setView: (next: View) => void;
    /** Put the gun back to level, cancelling any aim still on its way. */
    restAim: () => void;
  };

/** Open one vehicle on the canvas, and hand back the two ways of closing it. */
export async function openStage(
  surface: HTMLCanvasElement,
  live: () => boolean,
  handles: Opening,
  from: {
    code: string;
    skin?: string | null;
    fitted?: Mounted;
    liked: { centred: boolean; view: View };
    /**
     * The build of the mirror to read, and where this vehicle sits in it.
     *
     * Absent on every surface that does not render it server-side, which then
     * resolves the mirror for itself as before.
     */
    pinned?: { root: string; path: string; worn: string | null } | null;
    opening: {
      view?: string;
      hullDown?: boolean;
      aim?: { bearing: number; pitch: number };
      paint?: number;
      cut?: string;
    };
    /** Why the game refuses to dress it, where it does. Null where it can be. */
    paintLock: PaintLock | null;
    applyStance: () => void;
    takeAim: (bearing: number, pitch: number) => void;
    onAbsent?: () => void;
    /**
     * The style asked for was not in the mirror and the plain vehicle was
     * raised instead. A link outlives the style it was made with, so the page
     * takes it off rather than going on saying the reader is wearing one.
     */
    onUndressed?: () => void;
    column?: RefObject<HTMLElement | null>;
  },
  /**
   * Where the two ways of closing it are put, the moment they exist.
   *
   * **Not the return value.** A vehicle takes seconds to arrive and the reader
   * can leave inside that: awaited, these reach the caller after the cleanup
   * that needed them has already run, and an interrupted build keeps its loop
   * and its listeners on a canvas the next vehicle draws on.
   */
  closing: { freeze?: () => void; stop?: () => void } = {},
): Promise<void> {
  const [THREE, { OrbitControls }, { loadVisual }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/controls/OrbitControls.js"),
    import("@/services/tank-viewer"),
  ]);
  handles.setShown(false);
  handles.setStanding(false);
  // **The build the page named, where it named one.** The address is pinned to
  // a commit, so the commit is part of every path under it: a page that preloads
  // one build while this resolves another names the same files at two addresses
  // and the vehicle comes down twice, which is what it did. The page decides,
  // and what it decided is what its own preloads point at.
  //
  // Resolved here only where nothing was handed over, which is every surface
  // that is not the tank page: the comparison, and anything else that mounts a
  // viewer of its own.
  // **Ignored when the viewer is reading a tree on disk.** A developer can point
  // it at a freshly generated catalogue, and what the page pinned is the
  // published mirror: honoured here, the one page the local tree exists for
  // would be the one page that quietly ignores it. The markup emits no preloads
  // in that case either, so the two still name the same place.
  const pinned = process.env.NEXT_PUBLIC_MODELS_ROOT ? null : (from.pinned ?? null);
  const fromIndex = pinned ? null : await mirror();
  const root = pinned ? pinned.root : fromIndex!.root;
  const at = pinned ? pinned.path : fromIndex!.vehicles[from.code];
  if (!live()) return;
  // **Read after the first await, not before it.** Moving between vehicles
  // is a router transition: the new page is rendered while the old one is
  // still on screen, so this runs before the vehicle it is taking over from
  // has been torn down and has said where it was standing. One turn of the
  // loop is enough, and the manifest lookup above is one.
  const previous = inherited();
  handles.setCrossing(previous !== null);
  // Not in the mirror at all: there is no model coming, so the picture is
  // what this vehicle has.
  if (!at) {
    from.onAbsent?.();
    // The frame the vehicle before it left behind: nothing is coming to
    // draw over it, so it has to go rather than sit on the new page.
    release();
    return;
  }

  // The outgoing picture, held on a sheet while the next one is drawn under it.
  const { hold, dissolve } = heldFrame(surface, handles.ghost);

  // **What the vehicle is standing in, which is not always its own geometry.**
  // A reward vehicle is usually another tank plus a style the game will not let
  // its owner take off, and it ships no models of its own, so the index put us
  // on the tank underneath. Dressed here rather than left to the wardrobe: the
  // wardrobe is where a reader chooses, and there is no choice to make.
  //
  // A style the reader picked still wins, which costs nothing: the vehicles
  // that are issued wearing one are exactly the vehicles no wardrobe is offered
  // on, so the two can never both be set.
  const dressed =
    from.skin ?? (pinned ? pinned.worn : fromIndex?.worn[from.code]) ?? null;

  const made = await buildStage({
    surface,
    THREE,
    OrbitControls,
    loadVisual,
    loadArmour,
    at,
    root,
    fitted: from.fitted,
    skin: dressed,
    undressed: from.onUndressed,
    live,
    // Where the vehicle before it stood, so the room's very first frame holds
    // the same floor as the frame being handed over rather than correcting it
    // a few hundred milliseconds later.
    seen: previous,
    nudge: handles.nudge,
    // **The room first, and the vehicle into it.** Measured on a throttled
    // connection, the studio is lit about a second and a half before the
    // geometry has landed, and holding the canvas back for that second and a
    // half is what made the band look empty while something was very much
    // happening in it.
    lit: () => {
      if (live()) handles.setShown(true);
    },
  });
  if (!made) {
    from.onAbsent?.();
    release();
    return;
  }
  const {
    renderer,
    scene,
    camera,
    controls,
    vehicle,
    pivot,
    turret,
    gun,
    built,
    armour,
    collision,
    first,
    wake,
    awake,
  } = made;

  const offered = fitVehicle(
    {
      built,
      armour,
      collision,
      controls,
      rig: () => rig,
      turret,
      gun,
      first,
      at,
      root,
      wake,
      live,
      THREE,
      applyStance: from.applyStance,
      takeAim: from.takeAim,
      opening: from.opening,
      paintLock: from.paintLock,
    },
    { ...handles, skin: dressed },
  );

  handles.show.current = (next: View) => {
    // **The one that mattered most.** A view is a different picture drawn
    // from the same scene, and without this the switch was made, the state
    // changed, the controls updated and the frame was never repainted: the
    // armour views came up black.
    wake(VIEW_DISSOLVE + 400);
    void hold().then(() => {
      // **The floor loses its shadow here, and it is not yet fixed.** What
      // casts it is the visual model, which these views take off the scene, so
      // the patch under the vehicle goes out with it and the plates stand on a
      // bare grid. The plates cannot cast it in its place: the shadow pass
      // tests every object against the camera's own layers, and they are drawn
      // on layers of their own through targets of their own. Holding the map
      // over the switch (`shadowMap.autoUpdate`) was tried and measured, and
      // the shadow does not survive it either.
      built?.show(next === View.Visual);
      armour?.show(next !== View.Visual);
      if (next !== View.Visual) {
        armour?.ask(
          next === View.Live ? ArmourView.Live : ArmourView.Collision,
        );
      }
      handles.setView(next);
      // **Painted here, not left to the wake window.** A view swap changes
      // which objects are visible and nothing else: no camera moves, no
      // track turns, so the loop has nothing to notice. Waking it for a
      // while worked only by luck of timing, and the armour views came up
      // showing the vehicle they were meant to replace.
      frameOnce();
      wake(VIEW_DISSOLVE + 400);
      // Let the new view draw once under the held frame, then dissolve it.
      dissolve();
    });
  };

  const rig = rigFor({
    THREE,
    camera,
    controls,
    vehicle,
    turret,
    gun,
    previous,
    centredAtFirst: from.liked.centred,
    cinematicAtFirst: handles.cinematicRef.current,
    wake,
    setMoved: handles.setMoved,
    setCentred: handles.setCentred,
    // A reset puts the vehicle back as well as the frame: a reader who has
    // pointed the gun and put the tank on a ridge has changed the vehicle
    // as much as the camera, and moving only the camera is half an undo.
    atRest: () => {
      if (handles.hullDownRef.current) handles.ridge.current?.(false, false);
      handles.restAim();
      handles.aim.current?.(0, 0);
      gun.rotation.x = 0;
      turret.rotation.y = 0;
    },
    held: () => handles.hullDownRef.current,
  });
  handles.cine.current = rig.cinema;
  handles.reset.current = rig.reset;
  handles.recentre.current = rig.recentre;

  const running = runStage(
    {
      renderer,
      scene,
      camera,
      controls,
      surface,
      rig,
      built,
      armour,
      turret,
      gun,
      pivot,
      vehicle,
      wake,
      awake,
    },
    { ...handles, column: from.column, liked: from.liked },
  );
  const { freeze, stop, frameOnce, draw } = running;
  closing.freeze = freeze;
  closing.stop = stop;
  // Left in the meantime: the loop is up, so it is this that takes it down.
  if (!live()) {
    stop();
    return;
  }

  // **What the link asked for, once the vehicle can answer it.** None of
  // this exists before the model does: a view needs its armour built, a
  // ridge needs a gun to depress, and an aim needs something to aim.
  //
  // **And last of all, because a pose travels.** Put next to the views it
  // reads, it called a ridge that closes over `travel`, which is declared
  // two hundred lines further down: the call reached it before it existed,
  // the build threw where nobody was listening, and the vehicle never
  // appeared at all.
  //
  // Taken once, so a rebuild for a style or a gun does not drag the reader
  // back to the state the page opened on.
  if (!handles.restored.current) {
    handles.restored.current = true;
    // The framing this reader last chose, applied before the vehicle is
    // shown so it arrives where they left the last one rather than sliding
    // into place a moment after it appears.
    if (from.liked.centred) handles.recentre.current?.(true);
    // **The link outranks the habit.** A reader who reads armour gets the
    // armour on the next vehicle too, which is what the stored view is for,
    // but a link naming a view was written by somebody showing this tank in
    // that one and must not be answered with the reader's own setting.
    // Either way only where this vehicle can draw it: most offer Visual
    // alone, and Visual is what the scene already came up on.
    const wanted = from.opening.view ?? from.liked.view;
    const asked = offered.find((one) => one === wanted);
    if (asked && asked !== View.Visual) handles.show.current?.(asked);
    if (from.opening.hullDown) handles.ridge.current?.(true);
    if (from.opening.aim) from.takeAim(from.opening.aim.bearing, from.opening.aim.pitch);
  }
  // **Only what cannot be stood in for.**
  //
  // A texture is handed to a material before its bytes are there, which is
  // what lets the first frame draw early. Shown raw, that opened on a white
  // hull with black tracks and the paint landing a piece at a time: a vehicle
  // assembling itself in front of the reader, which is the one thing the fade
  // exists to avoid. So the maps that only dress a surface are not waited for
  // at all now, they are stood in for (`PRIMER` and its neighbours) and put on
  // together by `dress` once the vehicle is up. What is waited for here is the
  // belt's cut mask, which no stand-in can fake, and the few maps read as
  // values rather than as paint.
  //
  // The vehicle therefore appears as soon as it exists rather than as soon as
  // it is finished: measured, its meshes are in the browser seconds before its
  // three megabytes of paint, and standing a tank in primer in the meantime is
  // a picture instead of an empty studio.
  //
  // Waited in this order: the definition and the marks ask for more
  // textures, so they are settled after them, and the shaders are compiled
  // last, since a first frame that compiles two hundred programs is a
  // freeze wherever it happens.
  //
  // **Bounded, because a picture is better than a wait.** A mirror that
  // never answers for one map would otherwise leave the hero empty for
  // good, where the vehicle it has is perfectly worth looking at.
  await Promise.race([
    built
      .settled()
      .then(() => renderer.compileAsync(scene, camera))
      .catch(() => {}),
    new Promise((done) => setTimeout(done, PATIENCE)),
  ]);
  if (!live()) {
    stop();
    return;
  }
  revealVehicle({
    built,
    frameOnce,
    wake,
    draw,
    setShown: handles.setShown,
    setStanding: handles.setStanding,
  });
  // **And the camera stays exactly where it was.** Standing where the last
  // vehicle was seen from is what makes the two floors land on each other
  // while the tanks cross; sending it on to this vehicle's own framing
  // afterwards slid the grid across the scene a moment later, which is the
  // same thing happening late rather than not happening. One tank gives way
  // to another and nothing else moves.
  //
  // The framing this vehicle would have had is still `home`, so the reset
  // offers it: a Maus met at a light tank's distance is worth putting
  // right, and that is the reader's call rather than ours.
  // The room can be let go of now: there is a vehicle standing in it.
  // Harmless where nothing was held, which is a first visit.
  requestAnimationFrame(release);
}
