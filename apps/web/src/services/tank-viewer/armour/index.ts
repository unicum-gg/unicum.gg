// The vehicle as its armour, in the two ways a player asks about it.
//
// `collision` is what the plate is, which does not change: it reads the vehicle
// on its own terms and is the one to reach for when comparing two tanks rather
// than one duel. `live` is what a given shell would do here, which changes with
// the shell and with where it is fired from.
//
// **Three passes, not one.** One gathers the vehicle's own surfaces, a second
// adds every screen standing in front of them, and a third turns the sum into
// the colour a player reads. Doing it this way is what lets a track and the hull
// behind it answer as the one shot they really are, rather than the track being
// painted over the answer.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.
import type * as Three from "three";

import { NOT_ARMOUR, OPTICS, RAMP, swatch } from "./colours";
import {
  type Collision,
  type ShotUniforms,
  buildPlates,
  shotUniforms,
} from "./plates";
import { type Impact, probe } from "./probe";
import { COMPOSE, LAYER, SOLID_SHOT } from "./shaders";

export { type Impact, type Layer } from "./probe";

export { type Collision, type PlateFacts } from "./plates";

/** Which question the armour is being read for. */
export enum ArmourView {
  /** What a given shell would do here. */
  Live = "live",
  /** How thick the plate is, whatever is fired at it. */
  Collision = "collision",
}

/**
 * A shell, as the rules need it.
 *
 * Nominal penetration at the range being asked about, plus the four figures that
 * decide what an angle does to it. Those four come from the client rather than
 * from a table anyone wrote down, which is why a shell that has not published
 * them cannot be answered for.
 */
export type Shot = {
  penetration: number;
  caliber: number;
  normalisation: number;
  ricochet: number;
  /** The shell's own kind, which says whether the calibre rules apply at all. */
  kind: string;
};

export type LoadArmour = {
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  collision: Collision;
  /** Where each part hangs, shared with the visual view so a turret keeps its aim. */
  parentFor: (part: string) => Three.Object3D;
  /**
   * The pieces the vehicle is wearing, from the visual side.
   *
   * Both views draw the same tank, so both have to draw the same gun: a reader
   * who upgrades one and switches to the armour would otherwise be reading the
   * plates of a gun they are not holding.
   */
  shown?: string[];
};

export async function loadArmour({
  renderer,
  scene,
  camera,
  collision,
  parentFor,
  shown,
}: LoadArmour) {
  const three = await import("three");
  const shot: ShotUniforms = shotUniforms();
  const { meshes, hit, range } = buildPlates(three, collision, shot, parentFor, shown);
  const raycaster = new three.Raycaster();
  raycaster.layers.enableAll();
  const pointer = new three.Vector2();

  // Where the layers are gathered before anything is coloured.
  //
  //  R: the effective thickness of every screen standing in front
  //  G: what the surface under the pixel is, one of KIND
  //  B: that surface's own effective thickness
  //  A: how squarely it faces the camera, kept for the shading
  //
  // Both passes keep their depth, because whether a track hides a road wheel or
  // the wheel shows through is a question of which is in front.
  const depthOf = () => new three.DepthTexture(1, 1, three.UnsignedIntType);
  const gather = new three.WebGLRenderTarget(1, 1, {
    type: three.FloatType,
    depthTexture: depthOf(),
  });
  // Screens are gathered apart, with a depth of their own, and are read only
  // where the vehicle left the pixel empty. Keeping them in a second target is
  // what lets a track hide a road wheel while still being counted as a layer
  // over the hull rather than drawn on top of it.
  const shapes = new three.WebGLRenderTarget(1, 1, {
    type: three.FloatType,
    depthTexture: depthOf(),
  });

  const composed = {
    gathered: { value: gather.texture },
    screenShapes: { value: shapes.texture },
    gatheredDepth: { value: gather.depthTexture },
    screenDepth: { value: shapes.depthTexture },
    penetration: shot.penetration,
    byThickness: shot.byThickness,
    rampNone: { value: swatch(three, RAMP.none) },
    rampEven: { value: swatch(three, RAMP.even) },
    rampAlways: { value: swatch(three, RAMP.always) },
    colourRicochet: { value: swatch(three, 0xff66ff) },
    colourOvermatch: { value: swatch(three, 0x00ffff) },
    armourRange: { value: new three.Vector2(range[0], range[1]) },
    colourModule: { value: swatch(three, NOT_ARMOUR) },
    colourOptics: { value: swatch(three, OPTICS) },
    colourUnknown: { value: swatch(three, NOT_ARMOUR) },
  };

  const compose = new three.Mesh(
    new three.PlaneGeometry(2, 2),
    new three.ShaderMaterial({
      vertexShader:
        "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: COMPOSE,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: composed,
    }),
  );
  compose.frustumCulled = false;
  const overlay = new three.Scene();
  overlay.add(compose);
  const flat = new three.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let showing = false;
  const setSize = (w: number, h: number) => {
    const ratio = renderer.getPixelRatio();
    gather.setSize(Math.max(1, Math.floor(w * ratio)), Math.max(1, Math.floor(h * ratio)));
    shapes.setSize(Math.max(1, Math.floor(w * ratio)), Math.max(1, Math.floor(h * ratio)));
  };

  return {
    /** Every plate, so a caller can measure or hide the vehicle by its armour. */
    meshes,
    /** The span this vehicle's thickness scale is read against, in mm. */
    range,
    setSize,

    /** Whether the armour is the view being drawn, which the caller's own frame
     * has to know: nothing of the visual model belongs on screen while it is. */
    showing: () => showing,

    /**
     * What is under a point of the canvas, in normalised device coordinates.
     *
     * Answered by walking one ray rather than by reading the picture back: the
     * colour on screen is the answer, and this is the reason for it.
     */
    look(x: number, y: number, fired: Shot | null): Impact | null {
      if (!showing) return null;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      return probe(three, raycaster, hit, fired, shot.byThickness.value > 0.5);
    },

    /** Put the armour on the scene, or take it off and leave the visual view alone. */
    show(on: boolean) {
      showing = on;
      for (const plate of meshes) plate.visible = on;
    },


    /**
     * Which question to answer.
     *
     * The two views are one shader with a switch in it rather than two, because
     * everything up to the last step is the same work: the plates, the layers
     * and the depth are read the same way whichever question is being asked.
     */
    ask(view: ArmourView) {
      shot.byThickness.value = view === ArmourView.Collision ? 1 : 0;
    },

    /**
     * Load a shell into the rules.
     *
     * Returns false where the shell has not published what the rules need, which
     * is the honest answer rather than a default: normalisation and the ricochet
     * angle are not figures anyone can reasonably guess, and an armour view that
     * guesses them is confidently wrong.
     */
    fire(next: Shot | null): boolean {
      if (!next || !Number.isFinite(next.penetration) || !Number.isFinite(next.caliber)) {
        return false;
      }
      shot.penetration.value = next.penetration;
      shot.caliber.value = next.caliber;
      shot.normalisation.value = next.normalisation;
      shot.ricochetAngle.value = next.ricochet;
      shot.calibreRules.value = SOLID_SHOT.test(next.kind) ? 1 : 0;
      return true;
    },

    /**
     * Draw the vehicle's armour, in place of the ordinary render.
     *
     * The caller hands over its whole frame here: the passes clear and retarget
     * the renderer themselves, so this cannot sit alongside a plain
     * `renderer.render` of the same scene.
     */
    draw(behind?: () => void) {
      if (!showing) return false;
      const cleared = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);

      // The vehicle's own surfaces settle the depth, then every screen in front
      // of them is added to what they have to stop.
      renderer.setRenderTarget(gather);
      renderer.clear(true, true, false);
      camera.layers.set(LAYER.solid);
      renderer.render(scene, camera);
      camera.layers.set(LAYER.screen);
      renderer.render(scene, camera);

      // The screens again, on their own, for the shape they have where the
      // vehicle is not behind them.
      renderer.setRenderTarget(shapes);
      renderer.clear(true, true, false);
      camera.layers.set(LAYER.shape);
      renderer.render(scene, camera);

      renderer.setRenderTarget(null);
      renderer.clear(true, true, false);
      camera.layers.enableAll();
      // Whatever the page draws under the vehicle, the floor and its grid, so
      // the armour stands in the same room the visual view does.
      behind?.();
      renderer.render(overlay, flat);
      renderer.autoClear = cleared;
      return true;
    },

    dispose() {
      for (const plate of meshes) {
        plate.parent?.remove(plate);
        plate.geometry.dispose();
        const worn = Array.isArray(plate.material) ? plate.material : [plate.material];
        for (const one of worn) one.dispose();
      }
      compose.geometry.dispose();
      (compose.material as Three.Material).dispose();
      gather.dispose();
      shapes.dispose();
    },
  };
}
