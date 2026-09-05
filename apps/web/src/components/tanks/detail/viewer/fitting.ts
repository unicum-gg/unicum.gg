import type { Dispatch, RefObject, SetStateAction } from "react";
import type * as Three from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { MirrorStyle } from "@unicum.gg/wargaming";
import type { SkinFace } from "@/services/tank-viewer/styles";
import type { loadArmour, Shot } from "@/services/tank-viewer/armour";
import type { loadVisual } from "@/services/tank-viewer";
import type { Collision } from "@/services/tank-viewer/armour/plates";
import { skinNames, wardrobeFor } from "@/services/tank-viewer/styles";
import { DISTANCE } from "@/components/tanks/detail/viewer/framing";
import { MIRROR } from "@/components/tanks/detail/viewer/mirror";
import type { Rig } from "@/components/tanks/detail/viewer/rig";
import { View } from "@/components/tanks/detail/viewer/views";

/**
 * How much closer the camera stands for the hull-down pose, as a share of the
 * framing distance.
 *
 * **A judgement, not a measurement**, unlike the `DISTANCE` it is a share of.
 * The framing distance exists to match a picture, this one exists to read a
 * turret, and the plates that decide whether a turret holds are small. Standing
 * where the hero stands leaves them a few pixels across.
 */
const HULL_DOWN_CLOSER = 0.62;

/**
 * Which way the vehicle's nose points in it, as an angle round the vertical.
 *
 * Measured rather than guessed, after guessing it wrong twice: the Object 140's
 * hull spans 2.68 across and 6.31 along Z, so Z is its length and a camera on X
 * is looking at its flank. Zero is where the hangar view already stands, which
 * is the face the page has been showing all along.
 */
const HULL_DOWN_FACING = 0;

// Everything the vehicle is told once it exists.
//
// **None of it can be asked before the model is built**, which is what makes it
// a stage of its own rather than part of the page's state: how far the gun
// travels, whether there is a second texture set, how many marks the nation has,
// what styles the mirror carries for it. The page holds the answers, the model
// has them, and this is the one place the two meet.

/** What the built vehicle offers, and what the page wants told about it. */
export type Fitting = {
  define: RefObject<((next: "hd" | "sd") => void) | null>;
  dress: RefObject<((style: MirrorStyle | null, season: string) => void) | null>;
  fire: RefObject<((shot: Shot | null) => void) | null>;
  insignia: RefObject<((count: number) => void) | null>;
  joint: RefObject<number>;
  marksRef: RefObject<number>;
  painted: RefObject<boolean>;
  ridge: RefObject<((on: boolean, framing?: boolean) => void) | null>;
  sharpRef: RefObject<boolean>;
  shellRef: RefObject<Shot | null | undefined>;
  stance: RefObject<{
    travel: Collision["mounts"] | null;
    siege: NonNullable<Collision["mounts"]>["siege"];
    gun: string;
  } | null>;
  work: RefObject<(() => void) | null>;
  setCanDeploy: Dispatch<SetStateAction<boolean>>;
  setCutNames: Dispatch<SetStateAction<Record<string, SkinFace>>>;
  setCuts: Dispatch<SetStateAction<string[]>>;
  setHullDown: Dispatch<SetStateAction<boolean>>;
  setMarkable: Dispatch<SetStateAction<number>>;
  setRange: Dispatch<SetStateAction<[number, number]>>;
  setRolls: Dispatch<SetStateAction<boolean>>;
  setSharpenable: Dispatch<SetStateAction<boolean>>;
  setViews: Dispatch<SetStateAction<View[]>>;
  setWardrobe: Dispatch<SetStateAction<MirrorStyle[]>>;
  setWorks: Dispatch<SetStateAction<boolean>>;
  setWorn: Dispatch<SetStateAction<MirrorStyle | null>>;
  /** The 3D style being worn, by the folder the client publishes it under. */
  skin?: string | null;
};

/** Tell the page what this vehicle can do, and wire what it can be asked. */
export function fitVehicle(
  {
    built,
    armour,
    collision,
    controls,
    rig,
    turret,
    gun,
    first,
    at,
    wake,
    live,
    THREE,
    applyStance,
    takeAim,
    opening,
  }: {
    built: NonNullable<Awaited<ReturnType<typeof loadVisual>>>;
    armour: Awaited<ReturnType<typeof loadArmour>> | null;
    collision: Collision | null;
    controls: OrbitControls;
    /**
     * Read through a thunk: everything here that moves the camera does it from
     * a callback the page fires later, and the rig is built after this runs.
     */
    rig: () => Rig;
    turret: Three.Group;
    gun: Three.Group;
    first: (prefix: string) => string | undefined;
    /** Where this vehicle's geometry sits in the mirror. */
    at: string;
    wake: (ms?: number) => void;
    live: () => boolean;
    THREE: typeof import("three");
    /** Point the viewer at the state the reader has chosen. */
    applyStance: () => void;
    takeAim: (bearing: number, pitch: number) => void;
    /** What the link the page was opened on asked for. */
    opening: { paint?: number; cut?: string };
  },
  page: Fitting,
): View[] {
  page.setRolls(built.turns);
  // Offered only where there is one, which is a handful of vehicles: every
  // other tank would get a control that does nothing.
  page.setWorks(built.mechanism.clips.length > 0);
  page.work.current = () => {
    built.mechanism.play();
    wake();
  };
  // What the mounted gun can do at each bearing, which is what the dial
  // draws. The first gun, the way a stock loadout is shown.
  const mounted = first("Gun") ?? "";
  // **Two states, and the reader picks one.** A vehicle that deploys aims
  // one way while it drives and another once planted, and the client keeps
  // them as two definitions of the same tank rather than as one.
  page.joint.current = ((collision?.mounts?.gunJoint ?? 0) * Math.PI) / 180;
  page.stance.current = {
    travel: collision?.mounts ?? null,
    siege: collision?.mounts?.siege ?? null,
    gun: mounted,
  };
  page.setCanDeploy(collision?.mounts?.siege != null);
  applyStance();
  page.define.current = (next) => {
    // The other set has to be fetched, so this stays up while it lands.
    wake(3000);
    built.define(next);
  };
  page.setSharpenable(built.hasHd);
  page.insignia.current = (count: number) => {
    wake();
    void built.mark(count);
  };
  page.setMarkable(built.marksAvailable);
  // Put back what was being worn: this build may be a style the reader just
  // asked for rather than the first sight of the vehicle.
  if (built.marksAvailable > 0 && page.marksRef.current > 0) {
    void built.mark(page.marksRef.current);
  }
  // Straight to the larger set, on a tank that is already drawn. A reader
  // who has since asked for the standard one is not overruled.
  if (built.hasHd && page.sharpRef.current) built.define("hd");
  if (armour) page.setRange(armour.range);
  // **Hull down is a pose, not a hidden hull.** It is where a vehicle sits
  // when it has put a ridge under its nose: facing whoever is shooting at
  // it, gun down as far as it goes. That last part is the whole question,
  // because depressing the gun lifts the mantlet and turns the turret roof
  // towards the shot, and a turret that reads well level can read very
  // differently there.
  //
  // The vehicle is left whole. What a ridge covers depends on the ridge, and
  // drawing one would be inventing terrain to answer a question about steel.
  const depression =
    collision?.mounts?.pitch?.[first("Gun") ?? ""]?.[1] ?? 5;
  // **Two ways out, and they undo different amounts.** Pressing the button
  // is asking for the hangar back: the camera returns and the gun comes up
  // level with it. Taking hold of the vehicle is not asking for anything to
  // be undone, only to be let go of, so the tank stays exactly as it is and
  // the camera goes where the hand is taking it.
  page.ridge.current = (on, framing = true) => {
    wake();
    page.setHullDown(on);
    if (!on) {
      if (framing) {
        gun.rotation.x = 0;
        turret.rotation.y = 0;
        rig().travel({
          centring: 0,
          position: rig().home,
          target: rig().homeTarget,
        });
      } else {
        // Handed over to the aim rather than simply left alone: the barrel
        // would hold its angle either way, but the dial reads the aim, and
        // a dial saying level under a gun at full depression is the two
        // disagreeing about the same tank. Stated this way the reader can
        // also carry on moving it from where the pose left it.
        takeAim(0, -depression);
      }
      return;
    }
    // Turning about X swings the muzzle down, the same direction the client
    // counts its pitch in, so its own figure goes straight through.
    gun.rotation.x = (depression * Math.PI) / 180;
    // **The turret is set once and left there.** It used to be turned onto
    // the camera every frame, so the tank swung round to keep facing the
    // reader and the pose could never be walked round and looked at. Hull
    // down is a stance the vehicle is in, not a stare: it faces where the
    // shot is coming from, which is where the camera is put next, and after
    // that the reader is free to go and look at it from the side.
    turret.rotation.y = HULL_DOWN_FACING;
    // **Below it, by exactly as far as the gun is pointing down.**
    //
    // A hull-down tank is on a ridge and whoever it is shooting at is under
    // it, which is why the gun is depressed in the first place. Putting the
    // camera at the angle the muzzle is already looking down makes the two
    // agree: the vehicle aims at the reader because the reader is standing
    // where a tank it was fighting would be. Picking a height instead would
    // have been a number to argue about, and the gun would have pointed
    // somewhere past the shoulder.
    const rise = (-depression * Math.PI) / 180;
    const front = new THREE.Vector3(
      Math.cos(rise) * Math.sin(HULL_DOWN_FACING),
      Math.sin(rise),
      Math.cos(rise) * Math.cos(HULL_DOWN_FACING),
    );
    rig().travel({
      centring: 1,
      position: controls.target
        .clone()
        .addScaledVector(front, DISTANCE * HULL_DOWN_CLOSER),
      target: controls.target.clone(),
    });
  };
  // **Which questions this vehicle can actually answer.** Collision needs
  // only the plates, which are on the page already. Live needs the shell's
  // normalisation and ricochet angle, which the API does not publish yet, so
  // it is offered only once it can be answered rather than offered and wrong.
  const offered = [
    View.Visual,
    ...(armour ? [View.Collision] : []),
    ...(armour && armour.fire(page.shellRef.current ?? null) ? [View.Live] : []),
  ];
  page.setViews(offered);
  page.fire.current = (next) => {
    wake();
    armour?.fire(next);
  };
  // **Dressing is the one thing here the model does not arrive wearing.**
  // The recipes are a file of their own and a large one, so the vehicle is
  // drawn first and the wardrobe catches up: a reader who never opens it
  // has waited for nothing.
  page.dress.current = (style, when) => {
    // Dressing fetches its own textures, so this is worth staying up for
    // rather longer than a click.
    wake(3000);
    void built.wear(style, when);
  };
  // What else it could be cut as. Read off the vehicle rather than off the
  // style, so the list does not empty itself the moment one is worn.
  //
  // **And read from the vehicle where the page opened on a style.** A style
  // lists no styles: it is one set of models, and the vehicle is what knows
  // there are others. Built straight into one, from a shared link or a
  // reload, the list was never filled at all, so the wardrobe was not
  // offered and the reader had no way back out of the style they arrived
  // in. The manifest is small and already fetched for the vehicle itself.
  if (!page.skin) {
    page.setCuts(built.skins);
  } else {
    void fetch(`${MIRROR}/vehicles/${at}/model.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((bare: { skins?: string[] } | null) => {
        if (live() && bare?.skins?.length) page.setCuts(bare.skins);
      })
      .catch(() => {});
  }
  void skinNames(MIRROR).then((known) => {
    if (live()) page.setCutNames(known);
  });
  if (built.styles) {
    void wardrobeFor(MIRROR, at, built.styles).then((offered) => {
      if (!live()) return;
      page.setWardrobe(offered);
      // **The paint the link named, put on as the wardrobe arrives.** It
      // cannot be done any earlier: this list is the last thing the mirror
      // answers, well after the vehicle is standing there. Once, so a
      // rebuild for a gun or a style does not dress it again over whatever
      // the reader has since chosen.
      if (!page.painted.current && opening.paint != null) {
        page.painted.current = true;
        const one = offered.find((style) => style.id === opening.paint);
        if (one) page.setWorn(one);
      }
    });
  }
  /**
   * Hold the frame that is on screen, so the next view can arrive under it.
   *
   * Read inside the frame it is asking for: outside one, a WebGL canvas has
   * already been cleared and the copy comes back empty.
   */
  // The views this vehicle can offer, which the reveal reads to put back the
  // one a link asked for.
  return offered;
}
