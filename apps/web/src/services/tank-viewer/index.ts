// The vehicle as it looks in the game: its own meshes, its own textures, and a
// track laid link by link along the path the client ships.
//
// **Carried over from the pipeline's own viewer unchanged**, which is why it is
// one long file rather than the modules the rest of this folder is heading for.
// It is a thousand-odd lines whose every constant was measured against captures
// of the game, and splitting it blind is how the first attempt at porting it
// quietly replaced the studio's lighting with something invented. It is split
// with the viewer running and a tank on screen to check against, not before.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  MirrorModel,
} from "@unicum.gg/wargaming";

import { partOf } from "./decals";
import { studio } from "./lighting";
import { wardrobe } from "./styling";

import { runningGear } from "./running-gear";
import { materialShop, type Brush } from "./materials";
import { layBelts } from "./belts";
import { mechanism, type Animated } from "./mechanism";

/** The groups the pieces hang off, shared with whatever else draws this vehicle
 * so a turret keeps pointing where it was when the view changes. */
export type Mounts = {
  scene: THREE.Object3D;
  hull: THREE.Object3D;
  turret: THREE.Object3D;
  gun: THREE.Object3D;
};

/** The client ships each texture twice, the second at twice the side. */
export type Definition = "hd" | "sd";

/** A module choice per slot, by the game's own name for the module. */
export type Mounted = Partial<Record<"gun" | "turret" | "chassis", string>>;

export type LoadVisual = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Where the mirror is read from, without a trailing slash. */
  root: string;
  /** `russian/R45_IS-7`, the way the mirror files a vehicle. */
  vehicle: string;
  mounts: Mounts;
  /** Which of the two texture sets to load. */
  definition?: Definition;
  /**
   * The modules the reader has mounted, by the game's own name for each.
   *
   * The mirror publishes which piece a module draws under exactly these names,
   * so a build chosen in the configurator can be the one on screen. A slot left
   * out, or naming a module this vehicle has no piece for, falls back to the
   * stock loadout.
   */
  mounted?: Mounted;
  /** Lets a caller bust its own cache; identity by default. */
  fresh?: (url: string) => string;
};

/** The ribbon the chassis carries is the game's cheap stand-in for a track. */

/** A belt laid along one of the client's paths, with the links it took. */

/**
 * A road wheel, and what it takes to turn it in place.
 *
 * The bone it is skinned to sits at the origin, so the axle and the rest
 * transform are what keep the turn about the wheel rather than about the tank.
 */

/** `Object3D` carries no discriminant in its type, so the renderer's own
 * `isMesh` flag is what narrows a traversal. */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh =>
  (o as THREE.Mesh).isMesh === true;

/**
 * Build the textured vehicle into the groups the armour views already place.
 *
 * `mounts` are those groups: sharing them is what keeps the turret pointing the
 * same way when a player switches view, rather than snapping back to straight
 * ahead as though it were a different tank.
 */
export async function loadVisual({
  renderer,
  scene,
  root,
  vehicle,
  mounts,
  definition = "hd",
  mounted,
  fresh = (u: string) => u,
}: LoadVisual) {
  const model: MirrorModel = await (
    await fetch(fresh(`${root}/vehicles/${vehicle}/model.json`))
  ).json();
  const loader = new GLTFLoader();

  const brush: Brush = { part: "hull", piece: "" };
  const shop = materialShop(
    { renderer, model, root, fresh, definition },
    brush,
  );
  const { texture, material, materials, painted, surfaces, arriving } = shop;


  // A vehicle ships several turrets and guns, one per module a player can
  // mount.
  //
  // **The one the reader picked, where they have picked one.** The mirror
  // publishes which piece each module draws under the game's own name for it,
  // and the configurator knows that name for the build it is showing, so the
  // two meet here: choose the E 100's 15 cm gun and the viewer draws `Gun_06`.
  // Falls back to the first of each, which is the stock loadout and is what a
  // page with no choice made on it shows.
  const names = Object.keys(model.pieces).sort();
  const chosen = (slot: keyof Mounted) => {
    const key = mounted?.[slot];
    const piece = key ? model.modules?.[key] : undefined;
    return piece && model.pieces[piece] ? piece : undefined;
  };
  const first = (prefix: string) => {
    const slot =
      prefix === "Gun" ? "gun" : prefix === "Turret" ? "turret" : prefix === "Chassis" ? "chassis" : null;
    return (slot ? chosen(slot) : undefined) ?? names.find((n) => n.startsWith(prefix));
  };
  const pieces = [
    first("Hull"),
    first("Chassis"),
    first("Turret"),
    first("Gun"),
  ].filter((n): n is string => n !== undefined);

  const parts: THREE.Object3D[] = [];
  let triangles = 0;
  const parentFor = (name: string) => {
    if (name.startsWith("Chassis") || name.startsWith("Wheel"))
      return mounts.scene;
    if (name === first("Turret")) return mounts.turret;
    if (name === first("Gun")) return mounts.gun;
    return mounts.hull;
  };

  /** What each piece brought with it, for the handful that bring an animation. */
  const animated: Animated[] = [];
  for (const name of pieces) {
    const piece = model.pieces[name];
    brush.part = partOf(name);
    brush.piece = name;
    const gltf = await loader.loadAsync(
      fresh(`${root}/vehicles/${vehicle}/${piece.glb}`),
    );
    // A mesh drawn with several materials arrives as several meshes, so the
    // manifest's per-mesh lists are flattened into the same order.
    const order = (piece.meshes ?? []).flatMap((m) => m.materials);
    let index = 0;
    gltf.scene.traverse((o) => {
      if (!isMesh(o)) return;
      o.material = material(model.materials[order[index++] ?? -1]);
      o.castShadow = true;
      o.receiveShadow = true;
      // Occlusion samples the second UV set where the client ships one, and
      // falls back to the first where it does not.
      if (!o.geometry.getAttribute("uv1"))
        o.geometry.setAttribute("uv1", o.geometry.getAttribute("uv"));
      triangles += (o.geometry.index?.count ?? 0) / 3;
    });
    parentFor(name).add(gltf.scene);
    parts.push(gltf.scene);
    if (gltf.animations.length > 0) {
      animated.push({ scene: gltf.scene, clips: gltf.animations });
    }
    // Kept by piece, because a mark is placed on the piece the client hangs its
    // slot off rather than anywhere on the vehicle.
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      if (isMesh(o)) meshes.push(o);
    });
    surfaces.set(name, meshes);
  }

  const { belts, links, triangles: laid } = await layBelts({
    model,
    loader,
    root,
    vehicle,
    fresh,
    scene: mounts.scene,
    parts,
    material,
    brush,
  });
  triangles += laid;


  const gear = runningGear({ model, parts, belts });
  const mechanics = mechanism(animated);

  const room = studio(renderer, scene);
  const { environment, lights } = room;

  const { mark, wear } = wardrobe({
    model,
    scene,
    texture,
    surfaces,
    painted,
    first,
  });

  return {
    triangles,
    links,
    pieces,

    /**
     * The mechanism this vehicle works, for the handful that have one.
     *
     * Empty on every other tank, which is what a viewer offering it should
     * check rather than showing a control that does nothing.
     */
    mechanism: mechanics,
    /** The 3D styles this vehicle ships, by the name the client gives each. */
    skins: model.skins ?? [],
    /** How many marks of excellence the client has a texture for here. */
    marksAvailable: (model.marks ?? []).length,
    /** Put marks of excellence on the gun, or take them off with 0. */
    mark,
    /** Where the vehicle's 2D styles are listed, when it has any. */
    styles: model.styles ?? null,
    /** Put a 2D style on, or take it off with `null`. */
    wear,
    /**
     * Take the vehicle off the scene.
     *
     * Everything this loader adds hangs off the mount groups the armour views
     * share, so a rebuild that skipped this would leave the previous style
     * inside the next one.
     */
    dispose() {
      // **Detaching frees nothing.** Taking a mesh off the scene graph drops
      // the reference and leaves the card holding its buffers, and the canvas
      // outlives every rebuild, so a reader who tried three styles was three
      // whole vehicles into a context that would eventually be lost. The
      // geometry is per mesh and freed here, the maps and materials are shared
      // and freed by the cursor that deduplicated them.
      // What the cursor made, it frees itself, below. Everything else hanging
      // off the vehicle is a decal, and a decal owns a clone of the picture it
      // stamps, so its own map goes with it.
      const shared = new Set(shop.materials.map((one) => one.built));
      for (const part of parts) {
        part.parent?.remove(part);
        part.traverse((one) => {
          if (!isMesh(one)) return;
          one.geometry.dispose();
          const worn = Array.isArray(one.material) ? one.material : [one.material];
          for (const each of worn) {
            if (shared.has(each as THREE.MeshStandardMaterial)) continue;
            (each as THREE.MeshStandardMaterial).map?.dispose();
            each.dispose();
          }
        });
      }
      shop.dispose();
      room.dispose();
    },
    /** Show or hide the whole thing, lighting included. */
    show(on: boolean) {
      for (const part of parts) part.visible = on;
      lights.visible = on;
      scene.environment = on ? environment : null;
      // Khronos PBR Neutral, not ACES. ACES is a film curve: it desaturates as
      // it rolls off, which on a vehicle lit from every side turns paint to
      // grey. Measured on the IS-7 at the same exposure it costs a third of the
      // saturation the Neutral curve keeps (0.139 against 0.189), and the
      // Neutral one exists precisely for showing an object as it is.
      renderer.toneMapping = on
        ? THREE.NeutralToneMapping
        : THREE.NoToneMapping;
      // Low, because the environment is doing the lighting.
      //
      // This was 2.1, which was itself a step down from a 2.8 chosen to make the
      // average brightness match a capture of the game, and both were the same
      // mistake made twice: turning the exposure up to make up for an
      // environment that was turned down. What the texture holds, the rust on
      // the fender, the weld beads, the panel lines, flattens into pale cream
      // either way. The pair is what matters, and the pair is a bright
      // environment read at a low exposure.
      renderer.toneMappingExposure = 1.42;
      // The armour views draw flat answers and must not be shadowed.
      renderer.shadowMap.enabled = on;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    },
    /** Whether this vehicle published axles for its wheels. */
    turns: gear.turns,
    /** Whether it hangs its wheels from arms, which is what lets it kneel. */
    kneels: gear.kneels,
    /** Tip the body by `pitch` radians about `centre`, gear and belt with it. */
    kneel: gear.kneel,
    /** Run the gear as though the tank had travelled this far. */
    roll: gear.roll,
    /** Whether the mirror has a high-definition set for this vehicle. */
    hasHd: model.materials.some((m) =>
      Object.values(m.textures ?? {}).some((t) => t.hd),
    ),
    /**
     * Wait for every texture asked for so far, so nothing arrives on screen.
     *
     * Swapping definition or painting a style asks for more, so this is called
     * after those rather than before: it is "everything requested up to now",
     * not a promise that nothing else will ever be wanted.
     */
    async settled() {
      // A round at a time, since a texture that lands can be the reason the
      // next one is asked for.
      while (arriving.size > 0) await Promise.all([...arriving]);
    },
    /** Swap every material between the two definitions, in place. */
    define(next: Definition) {
      if (next === definition) return;
      definition = next;
      for (const { maps, built } of materials) {
        if (!built) continue;
        const surface = texture(maps.metallicGlossMap);
        built.map = texture(maps.diffuseMap);
        built.normalMap = texture(maps.normalMap);
        built.aoMap = texture(maps.excludeMaskAndAOMap);
        built.roughnessMap = surface;
        built.metalnessMap = surface;
        built.needsUpdate = true;
      }
    },
  };
}
