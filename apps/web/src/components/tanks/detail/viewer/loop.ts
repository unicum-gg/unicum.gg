import type { Dispatch, RefObject, SetStateAction } from "react";
import type * as Three from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { loadArmour } from "@/services/tank-viewer/armour";
import type { loadVisual } from "@/services/tank-viewer";
import type { Shot } from "@/services/tank-viewer/armour";
import { aimAt, type Sweep } from "@/components/tanks/detail/viewer/aiming";
import { ANCHOR_X, ANCHOR_Y } from "@/components/tanks/detail/viewer/framing";
import { hold as holdRoom } from "@/components/tanks/detail/viewer/handover";
import type { Reading } from "@/components/tanks/detail/viewer/readout";
import { Presentation } from "@/components/tanks/detail/viewer/presentation";
import type { Rig } from "@/components/tanks/detail/viewer/rig";
import { View } from "@/components/tanks/detail/viewer/views";

/** Where the cursor is on the picture, in both the units that need it. */
type Pointed = {
  x: number;
  y: number;
  css: { x: number; y: number };
  size: { width: number; height: number };
};

/** What the build handed over: everything the loop draws and moves. */
export type Stage = {
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  controls: OrbitControls;
  surface: HTMLCanvasElement;
  rig: Rig;
  built: NonNullable<Awaited<ReturnType<typeof loadVisual>>>;
  armour: Awaited<ReturnType<typeof loadArmour>> | null;
  turret: Three.Group;
  gun: Three.Group;
  pivot: Three.Group;
  /** Keep painting for a moment: something has changed, or is about to. */
  wake: (ms?: number) => void;
  /** Until when it keeps painting, which the loop reads every frame. */
  awake: () => number;
  /** Put the outgoing picture on a sheet of its own for the next vehicle. */
};

/** The handles the page keeps on the picture, and what it wants told back. */
export type Page = {
  arc: RefObject<[number, number] | null>;
  gunRange: RefObject<[number, number]>;
  held: RefObject<HTMLElement | null>;
  hullDownRef: RefObject<boolean>;
  hullRange: RefObject<number[] | null>;
  joint: RefObject<number>;
  pointing: RefObject<{ bearing: number; pitch: number } | null>;
  presentationRef: RefObject<Presentation>;
  recentre: RefObject<((on?: boolean) => void) | null>;
  restored: RefObject<boolean>;
  ridge: RefObject<((on: boolean, framing?: boolean) => void) | null>;
  rollingRef: RefObject<boolean>;
  runs: RefObject<Sweep | undefined>;
  shellRef: RefObject<Shot | null | undefined>;
  show: RefObject<((next: View) => void) | null>;
  watch: RefObject<((bearing: number) => void) | null>;
  setReading: Dispatch<SetStateAction<Reading | null>>;
  setShown: Dispatch<SetStateAction<boolean>>;
  column?: RefObject<HTMLElement | null>;
  liked: { centred: boolean };
};

// Drawing the picture, and everything that decides whether it is worth drawing.
//
// **Painted only when something has changed.** The scene sits still most of the
// time: a reader who has framed a tank and let go is looking at one picture, and
// a loop that redraws it sixty times a second is a fan spinning under a
// photograph. So every source of movement here says whether it moved, and the
// frame is taken only if one of them did.

/** Start drawing, and hand back the two ways of stopping. */
export function runStage(
  stage: Stage,
  page: Page,
): {
  freeze: () => void;
  stop: () => void;
  /** Paint one frame outright, whatever the loop has decided. */
  frameOnce: () => void;
  /** Start the loop. */
  draw: () => void;
} {
  const {
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
    wake,
    awake: awakeUntil,
  } = stage;
  let band = { left: 0, top: 0, width: 0, height: 0 };
  const resize = () => {
    wake();
    // Kept while the canvas is still in the document, in page coordinates:
    // the handover reads it as the viewer is torn down, by which point the
    // element may already be detached and measure nothing.
    const onPage = surface.getBoundingClientRect();
    if (onPage.width > 0) {
      band = {
        left: onPage.left + window.scrollX,
        top: onPage.top + window.scrollY,
        width: onPage.width,
        height: onPage.height,
      };
    }
    const { clientWidth: w, clientHeight: h } = surface;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // The armour views composite through targets of their own, which have to
    // follow the canvas: left at the one pixel they are born with, every
    // pass lands in it and the vehicle never appears.
    armour?.setSize(w, h);
    camera.aspect = w / h;
    // **Stand where the picture stood, so the swap is not a jump.**
    //
    // WG's portal renders put a vehicle's alpha centroid at a fixed place in
    // their 1920x900 frame, and the render route re-frames our own mirror
    // crops into that same layout; the hero is 32:15, the same ratio, so the
    // picture maps onto it without cropping and that place is a plain
    // fraction of the canvas. Framing the model dead centre instead put it a
    // tenth of a width off, which is small enough to read as a nudge and
    // large enough to see.
    //
    // Done with a view offset rather than by moving the camera: the frustum
    // shifts and the camera does not, so orbiting still turns about the
    // vehicle rather than about a point beside it.
    //
    // **And it stays there until it is asked to move.** The offset is the
    // hero's framing, not a seam to be undone: the vehicle sits off to the
    // left in perspective because that is where the page wants it, and
    // turning it around says nothing about wanting the page rearranged. The
    // button below is what brings it to the middle, for reading a hull
    // rather than looking at a hero.
    //
    // **The anchor is a fraction of the page.column, not of the canvas.** They
    // were the same thing while the hero ended where the reading did. Now
    // that it runs to the edges of the window they are not, and a vehicle
    // left at a fraction of the canvas drifts away from the title it is
    // supposed to stand beside, further on every wider screen.
    //
    // Both boxes are read the same way on purpose: `clientWidth` is in CSS
    // pixels and a bounding rect is in the pixels actually on screen, and
    // the two part company under any zoom or transform above this canvas.
    // Mixed, the vehicle lands somewhere neither frame asked for.
    const seen = surface.getBoundingClientRect();
    // Off the page, there is no page.column to keep to: what the picture is
    // framed within is all there is of it.
    const box =
      page.presentationRef.current === Presentation.Inline
        ? page.column?.current?.getBoundingClientRect()
        : undefined;
    const inset = box ? box.left - seen.left : 0;
    const across = box?.width || seen.width;
    const anchorX = seen.width
      ? (inset + ANCHOR_X * across) / seen.width
      : ANCHOR_X;
    const away = 1 - rig.centring;
    camera.setViewOffset(
      w,
      h,
      (0.5 - anchorX) * w * away,
      (ANCHOR_Y - 0.5) * -h * away,
      w,
      h,
    );
    camera.updateProjectionMatrix();
  };
  resize();
  const watching = new ResizeObserver(resize);
  watching.observe(surface);
  // The page.column moves on its own: below its maximum it follows the window,
  // above it stops and the margins take the difference instead.
  if (page.column?.current) watching.observe(page.column.current);

  // Read on the frame rather than on the event: pointer moves arrive far
  // faster than the picture changes, and a raycast per move would walk the
  // plates dozens of times for one drawing of them.
  let asked: Pointed | null = null;
  /** The pointer position the readout was last computed for. */
  let seen: Pointed | null = null;
  // **Named, because the canvas outlives the scene.** The element is the
  // page's and every rebuild draws on the same one, so a listener left behind
  // is not merely a listener: its closure holds this renderer, this scene and
  // this armour, and it keeps calling into a component that has moved on.
  const moved = (e: PointerEvent) => {
    const at = surface.getBoundingClientRect();
    asked = {
      x: ((e.clientX - at.left) / at.width) * 2 - 1,
      y: -((e.clientY - at.top) / at.height) * 2 + 1,
      // The same point in the units a panel is placed in. The canvas fills
      // the hero, so what is measured against one is measured against both.
      css: { x: e.clientX - at.left, y: e.clientY - at.top },
      size: { width: at.width, height: at.height },
    };
  };
  const left = () => {
    asked = null;
    page.setReading(null);
  };
  surface.addEventListener("pointermove", moved);
  surface.addEventListener("pointerleave", left);

  let frame = 0;
  let travelled = 0;
  let beat = performance.now();
  /** And what it answered, so an unchanged answer is not republished. */
  let shown: Reading | null = null;
  /** Whether two readouts say the same thing about the same plate. */
  const same = (a: Reading | null, b: Reading | null): boolean => {
    if (a === null || b === null) return a === b;
    return (
      a.at.x === b.at.x &&
      a.at.y === b.at.y &&
      a.impact === b.impact
    );
  };
  /**
   * Whether the picture is worth painting at all right now.
   *
   * **A hero nobody can see is a GPU running for nothing.** The band is at
   * the top of a long page, and a reader on the characteristics is three
   * thousand pixels past it: measured, the loop was still drawing at 120
   * frames a second down there.
   */
  let onScreen = true;
  const watchingScreen = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (onScreen) wake();
    },
    { rootMargin: "200px" },
  );
  if (page.held.current) watchingScreen.observe(page.held.current);

  const draw = () => {
    frame = requestAnimationFrame(draw);
    // **A track that never moves reads as a decal.** This is the idle crawl
    // a garage shows: slow enough to be a detail rather than a distraction,
    // and only for vehicles whose axles the mirror knows. The armour views
    // are answers rather than a tank in a garage, so nothing rolls in them.
    const now = performance.now();
    const step = Math.min((now - beat) / 1000, 0.1);
    beat = now;
    const rolled =
      built.turns && page.rollingRef.current && !armour?.showing();
    if (rolled) {
      travelled += step * 0.6;
      built.roll(travelled);
    }
    // The mechanism a handful of vehicles work. Unlike the tracks it does
    // not idle: it runs once, when someone asks to see it, and stops.
    const working = built.mechanism.running();
    if (working) built.mechanism.tick(step);
    // The camera moves on its own in two ways, and the rig owns both: a
    // journey somebody asked for, and the drift it falls into when nobody
    // has. A journey also reframes the band, which is why the two are
    // answered apart.
    const { travelling, drifted, gliding } = rig.step(step);
    if (travelling) resize();
    // Where the reader is standing, so the dial can say which side of the
    // vehicle the picture is being taken from.
    page.watch.current?.(rig.bearing());
    // Where the reader has pointed the gun. Hull down is a pose that owns
    // the turret for its own reason, so it keeps it.
    const pointed = page.pointing.current;
    if (pointed && !page.hullDownRef.current) {
      aimAt(
        pointed,
        {
          gun: page.gunRange.current,
          sweep: page.runs.current,
          hull: page.hullRange.current,
          joint: page.joint.current,
          arc: page.arc.current,
        },
        { gun, turret, pivot },
        built.kneels ? built.kneel : undefined,
      );
    }

    // **Painted only when something has changed.** Everything above is
    // arithmetic and costs nothing to run every frame; this is the part
    // that costs, and repeating it over a scene that has not moved is a
    // fan spinning under a still picture. Measured before this: 109 frames
    // a second with the camera stopped, the tracks stopped and nobody
    // touching anything.
    const busy =
      travelling ||
      gliding ||
      drifted ||
      rolled ||
      working ||
      performance.now() < awakeUntil();
    // **The readout is on the same terms as the paint.** It fires a ray
    // through every plate of the vehicle and then hands React a fresh
    // object, which is a re-render of the whole viewer and its controls. Run
    // unconditionally it did that sixty times a second while a reader
    // rested the cursor on a still tank, and went on doing it with the hero
    // scrolled three thousand pixels off the screen.
    const pointerMoved = asked !== seen;
    seen = asked;
    if (armour?.showing() && onScreen && (pointerMoved || busy)) {
      const found = asked
        ? armour.look(asked.x, asked.y, page.shellRef.current ?? null)
        : null;
      const next =
        found && asked
          ? { impact: found, at: asked.css, size: asked.size }
          : null;
      // Kept where it is when it says the same thing: React cannot bail out
      // of a state update whose value is a new object every time.
      if (!same(next, shown)) {
        shown = next;
        page.setReading(next);
      }
    }
    if (!onScreen || !busy) return;
    frameOnce();
  };
  /** Draw the scene as it stands, whatever the loop has decided. */
  const frameOnce = () => {
    // The armour views clear and retarget the renderer themselves, so they
    // take the frame rather than sharing it. The floor is handed to them so
    // the vehicle stands in the same room either way.
    const drawn = armour?.draw(() => {
      camera.layers.set(0);
      renderer.render(scene, camera);
    });
    if (!drawn) {
      renderer.render(scene, camera);
    }
  };

  // **The last frame of this vehicle, kept for the next one.**
  //
  // Drawn once more rather than read off the canvas as it stands: the
  // context is not asked to preserve its buffer, so a canvas read outside
  // the frame that painted it comes back empty. Rendering and copying in
  // the same turn is the same trick the view switch uses, without waiting
  // for an animation frame that a teardown does not get.
  const freeze = () => {
    // **The whole picture, floor and all.** Cut out of its room, the held
    // tank hung over an empty band until the next scene was up. Kept whole
    // and put back from the same camera it was taken from, the two floors
    // land on each other exactly and the only thing that crosses is the
    // vehicle, which is the point.
    frameOnce();
    holdRoom(surface, band, {
      position: camera.position.toArray(),
      target: controls.target.toArray(),
    });
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    watching.disconnect();
    watchingScreen.disconnect();
    surface.removeEventListener("pointermove", moved);
    surface.removeEventListener("pointerleave", left);
    armour?.dispose();
    // **The vehicle too, not only the room it stood in.** Disposing the
    // renderer frees the context, not the buffers the meshes and textures
    // hold on it, and a tank is a few dozen of each. Left behind on every
    // rebuild they accumulate until the context is lost, which is a picture
    // that goes black on a reader who has done nothing but press buttons.
    built?.dispose();
    controls.dispose();
    renderer.dispose();
  };

  return { freeze, stop, frameOnce, draw };
}
