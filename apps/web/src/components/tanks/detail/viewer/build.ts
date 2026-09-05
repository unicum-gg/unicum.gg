import type { RefObject } from "react";
import type * as Three from "three";
import type { OrbitControls as Controls } from "three/examples/jsm/controls/OrbitControls.js";

import type { loadArmour } from "@/services/tank-viewer/armour";
import type { loadVisual, Mounted } from "@/services/tank-viewer";
import type { Collision } from "@/services/tank-viewer/armour/plates";
import { hangar } from "@/components/tanks/detail/viewer/hangar";
import { MIRROR } from "@/components/tanks/detail/viewer/mirror";
import { SKIN_FOLDER } from "@/services/tank-viewer/styles";

// Putting the room and the vehicle together.
//
// **Nothing here knows what the reader has asked for.** It makes a renderer, a
// floor, the groups a tank hangs off and the tank itself, and hands them back.
// What the page then tells the vehicle, and what it draws every frame, are the
// two stages after this one, and keeping them apart is what lets each be read
// on its own.

/** The room, the vehicle, and the groups everything hangs off. */
export type Built = {
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  controls: Controls;
  vehicle: Three.Group;
  pivot: Three.Group;
  hull: Three.Group;
  turret: Three.Group;
  gun: Three.Group;
  built: NonNullable<Awaited<ReturnType<typeof loadVisual>>>;
  armour: Awaited<ReturnType<typeof loadArmour>> | null;
  collision: Collision | null;
  named: string[];
  first: (prefix: string) => string | undefined;
  worn: (slot: "gun" | "turret" | "chassis") => string | undefined;
  /** Keep painting for a moment: something has changed, or is about to. */
  wake: (ms?: number) => void;
  /** Until when it keeps painting, which the loop reads every frame. */
  awake: () => number;
};

/** Build the room and the vehicle in it, or nothing where a step gave up. */
export async function buildStage({
  surface,
  THREE,
  OrbitControls,
  loadVisual,
  loadArmour,
  at,
  fitted,
  skin,
  live,
  nudge,
}: {
  surface: HTMLCanvasElement;
  THREE: typeof import("three");
  OrbitControls: typeof Controls;
  loadVisual: typeof import("@/services/tank-viewer").loadVisual;
  loadArmour: typeof import("@/services/tank-viewer/armour").loadArmour;
  /** Where this vehicle's geometry sits in the mirror. */
  at: string;
  /** The modules the reader has picked, where they have picked any. */
  fitted?: Mounted;
  /** The 3D style being worn, by the folder the client publishes it under. */
  skin?: string | null;
  /** Whether the page still wants this build, which a navigation ends. */
  live: () => boolean;
  nudge: RefObject<((ms?: number) => void) | null>;
}): Promise<Built | null> {
  const renderer = new THREE.WebGLRenderer({
    canvas: surface,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  /**
   * Until when the picture keeps painting, whatever else is happening.
   *
   * **A window rather than a flag**, because a great deal of what changes
   * the picture does not finish in the frame it was asked for: a texture
   * lands, a style is fetched and applied, a view dissolves over half a
   * second, a shader compiles. One flag per cause would be a list nobody
   * could keep complete, and a stale entry on it is a picture that stops
   * updating under the reader's hand.
   */
  let awake = 0;
  /** Keep painting for a moment: something has changed, or is about to. */
  const wake = (ms = 900) => {
    awake = Math.max(awake, performance.now() + ms);
  };
  nudge.current = wake;
  const controls = new OrbitControls(camera, surface);
  controls.enableDamping = true;
  controls.enablePan = false;
  // **The belly is worth reaching.** An earlier pass stopped the camera at
  // the horizon on the grounds that there was nothing under a tank to look
  // at, which is wrong twice over: the hull bottom is where a vehicle's
  // armour is thinnest, and it is the one face the hangar photograph this
  // replaces could never show. So the limits are symmetric now, and what
  // they still hold back is only the two poles, where an orbit has no
  // heading left and the view spins about nothing.
  //
  // Nothing under the floor blocks the way: the shadow catcher faces up and
  // is culled from below, and the grid is drawn on both of its faces so the
  // belly is read against the same scale as the roof.
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI - 0.35;

  // **The pieces are hung off each other the way the vehicle is built**: the
  // hull rides on the chassis, the turret sits on the hull, the gun in the
  // turret. Where each ring is comes from the collision file, which is the
  // only thing that knows: a mesh carries no idea of where it belongs.
  //
  // Left at the origin, as a first pass had them, every piece is drawn in
  // the same place and the tank comes out as a heap with its tracks laid
  // over its roof.
  const collision: Collision | null = await fetch(
    `${MIRROR}/vehicles/${at}/collision.json`,
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!live()) return null;
  // **The piece the reader is wearing, not the one the vehicle was sold
  // with.** The mounts below are read per piece: where the gun hangs is a
  // property of the turret carrying it, and what the gun can do at each
  // bearing is a property of the gun. Choosing the E 100's 15 cm and
  // reading either off `Gun_04` puts the new barrel on the old mount and
  // gives it the stock gun's depression.
  const named = Object.keys(collision?.parts ?? {}).sort();
  const worn = (slot: "gun" | "turret" | "chassis") => {
    const key = fitted?.[slot];
    const piece = key ? collision?.modules?.[key] : undefined;
    return piece && collision?.parts?.[piece] ? piece : undefined;
  };
  const first = (prefix: string) => {
    const slot =
      prefix === "Gun"
        ? "gun"
        : prefix === "Turret"
          ? "turret"
          : prefix === "Chassis"
            ? "chassis"
            : null;
    return (
      (slot ? worn(slot) : undefined) ??
      named.find((n) => n.startsWith(prefix))
    );
  };
  const turretName = first("Turret") ?? "";

  // Something for the vehicle to stand on.
  //
  // **A hangar floor, not a photograph of one.** The picture it replaces is
  // shot from high above, so a model drawn at eye level on top of it reads
  // as pasted on; a floor built in the same space as the vehicle is seen
  // from wherever the vehicle is. It is a disc rather than a plane so it has
  // no edge to run into, faded out at the rim so it has no horizon either,
  // and a grid faint enough to give the eye a scale without becoming
  // graph paper.
  //
  // **The floor is the grid, and nothing else.** An earlier pass painted the
  // disc a shade above the page and drew lines on it, which gave the vehicle
  // a plate to stand on and gave the eye a second edge to read. What is
  // wanted here is the scale, not the surface, so the disc paints only where
  // a line falls and the page shows through everywhere else. The disc is
  // still there, unpainted: it is what fades the grid out at the rim.
  //
  // Its colour is the page's, read rather than chosen, and the token is the
  // one the site marks with. `--border` was the first choice and the wrong
  // one: nine levels of grey off the surface it was drawn on, so the grid
  // compiled, ran, and could not be seen. How loud it lands is the shader's
  // business below, which keeps that in one place rather than in a hex
  // nobody can trace back to the palette.
  // Resolved on the canvas, so the floor takes the hero's own theme rather
  // than the page's: the hero is dark in both.
  hangar(THREE, scene, surface);
  const vehicle = new THREE.Group();
  // **The point the body tips about, which is not where it hangs.** The
  // client names it along the hull and it is a metre out on some vehicles;
  // pivoting at the mount instead lifts or drops the whole body as it
  // turns, and the running gear underneath does not follow, so the track
  // guards come down through their own tracks.
  const seat = collision?.hullPosition ?? [0, 0, 0];
  const tipsAt = collision?.mounts?.siege?.hullPitchCentre ?? 0;
  const pivot = new THREE.Group();
  const hull = new THREE.Group();
  pivot.position.set(seat[0] ?? 0, seat[1] ?? 0, tipsAt);
  hull.position.set(0, 0, (seat[2] ?? 0) - tipsAt);
  pivot.add(hull);
  // **The ring the turret turns on, which is not always level.** Four
  // vehicles mount it at an angle and set the gun's joint to cancel that
  // angle, so the barrel sits level at rest and sweeps a cone as the turret
  // comes round. Mounted flat the pair cancels to nothing and the gun keeps
  // its full depression all the way round, which on the Kunze Panzer puts
  // the barrel through its own engine deck.
  const ring = new THREE.Group();
  ring.position.fromArray(collision?.mounts?.turret ?? [0, 0, 0]);
  ring.rotation.x = ((collision?.mounts?.turretPitch ?? 0) * Math.PI) / 180;
  const turret = new THREE.Group();
  const gun = new THREE.Group();
  gun.position.fromArray(
    collision?.mounts?.guns?.[turretName] ?? [0, 0, 0],
  );
  turret.add(gun);
  ring.add(turret);
  hull.add(ring);
  vehicle.add(pivot);
  scene.add(vehicle);

  let built;
  try {
    built = await loadVisual({
      renderer,
      scene,
      root: MIRROR,
      // **A 3D style is the same vehicle from another folder.** It is a
      // complete set of pieces with textures of its own, published beside
      // the vehicle, so wearing one is a different path and nothing else.
      vehicle: skin ? `${at}/${SKIN_FOLDER}/${skin}` : at,
      mounts: { scene: vehicle, hull, turret, gun },
      definition: "sd",
      mounted: fitted,
    });
  } catch {
    // A build that failed: the caller shows what was underneath, which is
    // already the right thing to be looking at. The context goes with it, as
    // it does on every other way out of here.
    renderer.dispose();
    return null;
  }
  if (!live()) {
    renderer.dispose();
    return null;
  }
  // The loader brings its own hangar, its four lamps and the exposure they
  // were balanced against, and hands back the switch rather than throwing
  // them at the renderer: the armour views share this canvas and draw flat
  // answers an environment map would wash out. Nothing here draws anything
  // else yet, but leaving it off is what left the vehicle lit by the
  // renderer's defaults, a uniform gold with no reflection in it.
  built.show(true);

  // The armour, on the same mounts, so a turret aimed in one view is aimed
  // in the other. It is built once and hidden rather than rebuilt on every
  // switch: a collision shell is a few hundred triangles, and paying for it
  // twice would put a stutter on a control that should feel like a toggle.
  const armour = collision
    ? await loadArmour({
        renderer,
        scene,
        camera,
        collision,
        shown: built?.pieces,
        parentFor: (part: string) =>
          part.startsWith("Chassis") || part.startsWith("Wheel")
            ? vehicle
            : part.startsWith("Turret")
              ? turret
              : part.startsWith("Gun")
                ? gun
                : hull,
      }).catch(() => null)
    : null;
  if (!live()) {
    armour?.dispose();
    renderer.dispose();
    return null;
  }
  armour?.show(false);
  return {
    renderer,
    scene,
    camera,
    controls,
    vehicle,
    pivot,
    hull,
    turret,
    gun,
    built,
    armour,
    collision,
    named,
    first,
    worn,
    wake,
    awake: () => awake,
  };
}
