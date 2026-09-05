// The vehicle as a set of plates, built from what the client collides against.
//
// A collision mesh is not the model a player sees: it is the shell the game
// actually shoots at, one group per named plate, and the thickness table beside
// it says what each of those plates is made of. Everything the armour views
// answer comes from these two together.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/live.html`.
import type * as Three from "three";

import {
  KIND,
  LAYER,
  MODULE,
  OPTIC,
  SCREEN,
  SCREEN_SHAPE,
  SOLID,
  TRACK,
  VERTEX,
} from "./shaders";

/** One part of the collision shell, as the mirror publishes it. */
export type CollisionPart = {
  positions: number[];
  indices: number[];
  groups: { start: number; count: number; name: string }[];
};

/** What the mirror publishes about a vehicle's armour. */
export type Collision = {
  parts: Record<string, CollisionPart>;
  armor?: Record<string, Record<string, number>>;
  spaced?: Record<string, string[]>;
  hullPosition?: number[];
  /**
   * Which piece each module draws, under the game's own name for it.
   *
   * The same map the visual model carries, published here too because the
   * mounts below are read per piece: where the gun hangs is a property of the
   * turret carrying it, and what the gun can do is a property of the gun.
   */
  modules?: Record<string, string>;
  /** Where each piece hangs off the one below it, in the vehicle's own space. */
  mounts?: {
    turret?: number[] | null;
    guns?: Record<string, number[]>;
    yaw?: Record<string, number[]>;
    pitch?: Record<string, number[]>;
    /**
     * What the gun can do at each turret bearing, which is not one pair.
     *
     * Runs of `(bearing, degrees)`, the bearing a fraction of a full turn from
     * straight ahead: the Tiger's gun goes 8 degrees down over the nose and 3
     * over the engine deck, because its own deck is in the way. `pitch` above
     * is the widest of these, which is all a reader needs who is not asking
     * where the turret points.
     */
    sweep?: Record<string, { up: number[][]; down: number[][] }>;
    /**
     * How far the hull itself tips, for a vehicle that aims by kneeling.
     *
     * **Only ever inside `siege`.** A vehicle carries the block in both of its
     * definitions and switches it on in the deployed one alone, so a tank that
     * tips while driving is a tank that has never existed. Kept here because
     * the deployed state has the same shape as the travelling one.
     */
    hullPitch?: number[] | null;
    /**
     * The angle the turret ring is mounted at, in degrees, where it is not
     * level, with the gun joint that cancels it. Four vehicles have this, and
     * without it their gun keeps its full depression all the way round.
     */
    turretPitch?: number | null;
    gunJoint?: number | null;
    /**
     * The same aiming, as the vehicle stands once it has deployed.
     *
     * 67 vehicles ship a second definition of themselves for this: the Strv
     * 103B's gun is pinned at one degree while it drives and gets four down and
     * two up once planted, on top of eleven either way from the hull. Absent
     * for everything with nothing to deploy.
     */
    siege?: {
      yaw?: Record<string, number[]>;
      pitch?: Record<string, number[]>;
      sweep?: Record<string, { up: number[][]; down: number[][] }>;
      hullPitch?: number[] | null;
      /**
       * Where along the hull the tipping pivots, in metres from the origin.
       *
       * Not where the hull hangs: 1.165 m out on the Kunze Panzer and the
       * UDES 16. Tipped about the wrong point the body rises or falls as well
       * as turning, and the running gear it is tipping over does not follow.
       */
      hullPitchCentre?: number | null;
    } | null;
  };
};

/** What a plate knows about itself, for the readout to name it. */
export type PlateFacts = {
  part: string;
  name: string;
  thickness: number | null;
  spaced: boolean;
  module: boolean;
  optic: boolean;
};

export type Plates = {
  /** Everything drawn, so a view can take it all off the scene again. */
  meshes: Three.Mesh[];
  /**
   * The plates a shot actually meets, which is not everything drawn.
   *
   * The screen twins are left out: they exist so a track reaching past the hull
   * has a silhouette, and counting them would put every track in the readout
   * twice.
   */
  hit: Three.Mesh[];
  /** The span of this vehicle's own armour, thinnest to thickest, in mm. */
  range: [number, number];
};

/**
 * The uniforms every plate shares, so one assignment reaches all of them.
 *
 * A shot is a property of the view, not of a plate: changing shell has to move
 * every plate at once or half the vehicle answers the old question.
 */
export type ShotUniforms = {
  penetration: { value: number };
  byThickness: { value: number };
  caliber: { value: number };
  normalisation: { value: number };
  ricochetAngle: { value: number };
  calibreRules: { value: number };
};

export function shotUniforms(): ShotUniforms {
  return {
    penetration: { value: 0 },
    byThickness: { value: 0 },
    caliber: { value: 0 },
    normalisation: { value: 0 },
    ricochetAngle: { value: 90 },
    // The calibre rules are a solid shot's: a shaped charge burns through rather
    // than punching, so it neither straightens against a thick plate nor
    // overmatches a thin one, and it glances off at its own angle whatever its
    // calibre.
    calibreRules: { value: 1 },
  };
}

/**
 * The span of armour this vehicle carries, which the thickness scale is read
 * against.
 *
 * Screens are left out of it: a skirt is not part of what makes a hull thick,
 * and counting one would flatten the scale every real plate is read on.
 */
export function armourRange(collision: Collision): [number, number] {
  const thicknesses: number[] = [];
  for (const [part, table] of Object.entries(collision.armor ?? {})) {
    const screens = new Set(collision.spaced?.[part] ?? []);
    for (const [name, value] of Object.entries(table)) {
      if (name.startsWith("armor_") && !screens.has(name)) thicknesses.push(value);
    }
  }
  return thicknesses.length ? [Math.min(...thicknesses), Math.max(...thicknesses)] : [0, 1];
}

/**
 * Build every plate and hang it off the group its part belongs to.
 *
 * Each named group of the collision mesh becomes its own mesh with its own
 * material, because each carries a different thickness and a shader reads one
 * thickness at a time. They are cheap: a collision shell is a few hundred
 * triangles where the visual model is tens of thousands.
 */
/**
 * Which of a vehicle's parts to draw, one per family.
 *
 * A gun or a turret ships every variant it was ever sold with, and only the
 * first belongs with the rest of the model, which is placed for it.
 *
 * **The first is not the one numbered 01.** An earlier rule kept whatever ended
 * in `_1` and dropped the rest, which is right until a vehicle publishes no
 * `_01`: the Object 140 collides through `Gun_03` alone, so its barrel was
 * dropped and the tank was drawn holding nothing. What the rule wants is the
 * lowest of each family, whatever number that turns out to be, which is also how
 * the visual side picks its pieces.
 */
function shownParts(collision: Collision, shown?: string[]): string[] {
  const rank = (name: string) => Number(name.match(/_(\d+)$/)?.[1] ?? 0);
  const family = (name: string) => name.replace(/_\d+$/, "");
  const first = new Map<string, string>();
  for (const name of Object.keys(collision.parts)) {
    const held = first.get(family(name));
    if (!held || rank(name) < rank(held)) first.set(family(name), name);
  }
  // **The pieces the vehicle is actually wearing, where the caller knows.** A
  // reader who upgrades the gun gets the gun they picked in every view, not the
  // lowest-numbered one here and the chosen one next door.
  //
  // Family by family rather than wholesale: a vehicle can publish a mesh for a
  // piece and no shell for it, and taking the caller's list as the whole answer
  // would then draw a tank with no barrel rather than one holding the gun it
  // was sold with.
  for (const name of shown ?? []) {
    if (collision.parts[name]) first.set(family(name), name);
  }
  return [...first.values()].sort();
}

export function buildPlates(
  three: typeof import("three"),
  collision: Collision,
  shot: ShotUniforms,
  parentFor: (part: string) => Three.Object3D,
  shown?: string[],
): Plates {
  const meshes: Three.Mesh[] = [];
  const hit: Three.Mesh[] = [];
  for (const part of shownParts(collision, shown)) {
    const mesh = collision.parts[part]!;
    const table = collision.armor?.[part] ?? {};
    const screens = new Set(collision.spaced?.[part] ?? []);
    const parent = parentFor(part);
    const positions = new Float32Array(mesh.positions);

    for (const group of mesh.groups) {
      const geometry = new three.BufferGeometry();
      geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
      geometry.setIndex(mesh.indices.slice(group.start, group.start + group.count));
      geometry.computeVertexNormals();

      const thickness = table[group.name] ?? null;
      const isModule = MODULE.test(group.name);
      const isOptic = OPTIC.test(group.name);
      // A screen stands off the vehicle: beating it reaches nothing, only what
      // lies behind. Tracks are the screen every vehicle carries.
      const spaced =
        !isModule && thickness !== null && (screens.has(group.name) || TRACK.test(group.name));
      const kind = isOptic
        ? KIND.optics
        : isModule
          ? KIND.module
          : thickness === null
            ? KIND.unknown
            : KIND.armour;

      const material = new three.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: spaced ? SCREEN : SOLID,
        uniforms: { ...shot, thickness: { value: thickness ?? 0 }, kind: { value: kind } },
        side: three.FrontSide,
        // Screens add their thickness to what the pass before found, so they
        // blend as a plain sum. The stock additive mode weighs the source by its
        // alpha, and this shader keeps alpha at zero so it would add nothing.
        ...(spaced
          ? {
              blending: three.CustomBlending,
              blendSrc: three.OneFactor,
              blendDst: three.OneFactor,
              depthWrite: false,
              transparent: true,
            }
          : {}),
      });

      const plate = new three.Mesh(geometry, material);
      plate.layers.set(spaced ? LAYER.screen : LAYER.solid);
      plate.userData = {
        part,
        name: group.name,
        thickness,
        spaced,
        module: isModule,
        optic: isOptic,
      } satisfies PlateFacts;
      parent.add(plate);
      meshes.push(plate);
      hit.push(plate);

      // A screen is counted where the vehicle stands behind it, but it is also a
      // shape in its own right: a track reaching past the hull would otherwise
      // be a hole in the silhouette. This twin draws that shape, writing no
      // depth so the vehicle paints over it.
      if (spaced) {
        const shape = new three.Mesh(
          geometry,
          new three.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: SCREEN_SHAPE,
            uniforms: { thickness: { value: TRACK.test(group.name) ? -1 : (thickness ?? 0) } },
            side: three.FrontSide,
          }),
        );
        shape.layers.set(LAYER.shape);
        parent.add(shape);
        meshes.push(shape);
      }
    }
  }
  return { meshes, hit, range: armourRange(collision) };
}
