import * as THREE from "three";

import type { MirrorMaterial, MirrorModel, MirrorTexture } from "@unicum.gg/wargaming";
import { compile, withDetail, type CamoUniforms, type PaintedMaterial } from "./shader";
import { BLANK, FLAT } from "./textures";

// Turning the mirror's materials into the renderer's.
//
// One place, because every surface of a vehicle goes through it and they are
// not independent: a texture the client shares between the hull and the turret
// is fetched once and handed to both, and a material that can take paint has to
// be built able to before it is compiled, not patched afterwards. Keeping the
// cache, the fetch and the build together is what makes both true.

/** A material value the client writes as a number, read back defensively: the
 * same key is a float on one material and a string on another. */
function numberAt(
  values: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const raw = values[key];
  return typeof raw === "number" ? raw : fallback;
}

/**
 * Which piece of the vehicle is being built, as the loader walks them.
 *
 * A style paints per part rather than per mesh, so a material has to know what
 * it belongs to at the moment it is made. The loader moves this along as it
 * goes and the shop reads it, which is what the two shared through a pair of
 * closure variables before.
 */
export type Brush = { part: string; piece: string };

export type MaterialShop = ReturnType<typeof materialShop>;

/** Open a shop for one vehicle: its textures, its materials, and what they paint. */
export function materialShop(
  {
    renderer,
    model,
    root,
    fresh,
    definition,
  }: {
    renderer: THREE.WebGLRenderer;
    model: MirrorModel;
    /** Where the mirror is read from, which a texture path hangs off. */
    root: string;
    fresh: (url: string) => string;
    definition: "hd" | "sd";
  },
  brush: Brush,
) {
  const loaded = new Map<string, THREE.Texture>();
  const textures = new THREE.TextureLoader();
  /**
   * Every texture asked for and not yet arrived.
   *
   * **A texture is handed back before it exists.** `load` returns the object at
   * once and fills it in when the bytes land, which is what lets a viewer draw
   * the moment the meshes are up. It is also what makes a vehicle assemble
   * itself in front of a reader: the hull appears white, the tracks appear
   * black, and the paint arrives a piece at a time. Kept so a caller that
   * would rather wait can.
   */
  const arriving = new Set<Promise<void>>();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const materials: {
    spec: MirrorMaterial | undefined;
    maps: Record<string, MirrorTexture>;
    built?: THREE.MeshStandardMaterial;
  }[] = [];
  // The client ships each texture twice, the second at twice the side. Which of
  // the pair a material samples is the only difference between the two
  // definitions: the mesh, the layout and the UVs are one and the same.
  const choose = (entry: MirrorTexture) =>
    definition === "hd" && entry.hd ? entry.hd : entry.path;
  function texture(entry: MirrorTexture): THREE.Texture;
  function texture(
    entry: MirrorTexture | undefined | null,
  ): THREE.Texture | null;
  function texture(
    entry: MirrorTexture | undefined | null,
  ): THREE.Texture | null {
    if (!entry) return null;
    const at = choose(entry);
    const cached = loaded.get(at);
    if (!cached) {
      // Failures settle rather than reject: a missing map is a vehicle drawn
      // without it, which is what happens today, and not a build that never
      // finishes.
      let arrived: () => void = () => {};
      const waiting = new Promise<void>((done) => {
        arrived = done;
      });
      arriving.add(waiting);
      void waiting.then(() => arriving.delete(waiting));
      const map = textures.load(fresh(`${root}/${at}`), arrived, undefined, arrived);
      // The mirror stores UVs the way glTF reads them, top down.
      map.flipY = false;
      // A track's UVs run to 30 so its texture repeats along the run. three
      // clamps by default, which smears the edge pixel over the whole belt
      // instead of drawing the links.
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.colorSpace =
        entry.colorSpace === "srgb" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      // As sharp as the card allows at a grazing angle, which is most of a
      // track's run and most of a hull's flank.
      map.anisotropy = maxAnisotropy;
      loaded.set(at, map);
      return map;
    }
    return cached;
  }

  /**
   * Every material that can take paint, with the brush.part it belongs to.
   *
   * A style paints per brush.part: a camouflage usually covers the hull, the turret
   * and the gun while a paint underneath it reaches the running gear too, so
   * knowing only that a material can be painted is not enough.
   */
  const painted: PaintedMaterial[] = [];
  /** Which piece is being read, so its materials can be filed under it. */

  /** The meshes each piece drew with, for anything projected onto them. */
  const surfaces = new Map<string, THREE.Mesh[]>();

  // Whether this build of the mirror packs the client's alpha mask in the
  // normal map's blue. An older one leaves that channel at zero, and cutting
  // against it would discard every pixel of every track.
  const masked = (model.features ?? []).includes("normal-mask");

  function material(spec: MirrorMaterial | undefined) {
    const maps = spec?.textures ?? {};
    materials.push({ spec, maps });
    // The mirror already rewrites the client's gloss-metal texture into the
    // metal-roughness layout, so it is sampled straight.
    const surface = texture(maps.metallicGlossMap);
    const built = new THREE.MeshStandardMaterial({
      map: texture(maps.diffuseMap),
      normalMap: texture(maps.normalMap),
      aoMap: texture(maps.excludeMaskAndAOMap),
      roughnessMap: surface,
      metalnessMap: surface,
      // Without these a track draws as a solid ribbon: its gaps are cut by an
      // alpha test, and its far side only exists when both are drawn.
      // What the client says, which is single-sided for a hull or a turret and
      // both for a track: a belt's far side only exists when both are drawn.
      side: spec?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      // Only where the mirror does not carry the client's own mask. Where it
      // does, the cut is made in the shader instead and this must be off, or
      // the two tests fight and the track loses either its gaps or its links.
      alphaTest: masked ? 0 : (spec?.alphaTest ?? 0),
      roughness: 1,
      metalness: 1,
      // The client's gloss is perceptual, which is the scale three's roughness
      // map is on too, so the map goes in as it is and the environment carries
      // the rest.
      envMapIntensity: 1.35,
    });
    // What the client says about cutting this material, if it says anything.
    // `alphaReference` arrives as a byte, the way the client writes it.
    // Only a material the client gave a mask takes paint, which is the right
    // answer on its own: a decal sheet or a track has none and so stays as it
    // is, exactly as it does in the game.
    // **The belt is not painted.** The running gear takes a style, the track
    // links do not: they are bare steel that has been dragged through the
    // ground, and the game leaves them that way. They come in as a piece of
    // their own, so this is where they are held back.
    if (
      (maps.colorIdMap || maps.diffuseMap) &&
      brush.piece !== model.tracks?.segment
    ) {
      const camo: CamoUniforms = {
        camoTurn: { value: 0 },
        // Always a real texture. An unbound sampler reads black, and a shader
        // that samples one is not obviously broken until something disappears.
        camoPattern: { value: BLANK },
        camoTiling: { value: new THREE.Vector4(1, 1, 0, 0) },
        camoColors: {
          value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)),
        },
        // What each of the piece's four regions is repainted, alpha carrying
        // whether it is repainted at all.
        camoRegionA: { value: new THREE.Vector4(0, 0, 0, 0) },
        camoRegionB: { value: new THREE.Vector4(0, 0, 0, 0) },
        camoRegionC: { value: new THREE.Vector4(0, 0, 0, 0) },
        camoRegionD: { value: new THREE.Vector4(0, 0, 0, 0) },
        // Where the four regions are, as four flat greys. A piece with no map
        // of its own reads black and is region zero throughout.
        camoIdMap: { value: texture(maps.colorIdMap) ?? BLANK },
        // What the material shifts that read by, which a handful of them do.
        camoBias: { value: numberAt(spec?.values ?? {}, "g_maskBias", 0) },
        // The finish, one value per palette colour. The client's own defaults
        // stand in for the camouflages that name neither, which is most of them.
        camoPaintGloss: {
          value: new THREE.Vector4(0.509, 0.509, 0.509, 0.509),
        },
        camoPaintMetal: { value: new THREE.Vector4(0.23, 0.23, 0.23, 0.23) },
        camoGlossSet: { value: new THREE.Vector4(0.509, 0.509, 0.509, 0.509) },
        camoMetalSet: { value: new THREE.Vector4(0.23, 0.23, 0.23, 0.23) },
        camoGlossMetalMap: { value: BLANK },
        camoHasGlossMetal: { value: 0 },
        camoNormalMap: { value: FLAT },
        camoNormalStrength: { value: 0 },
        camoEmissionMap: { value: BLANK },
        camoEmissionPower: { value: 0 },
        camoCover: { value: 0 },
      };
      built.userData.camo = camo;
      painted.push({ uniforms: camo, part: brush.part, piece: brush.piece });
    }

    const values = spec?.values ?? {};
    if (masked && values.alphaTestEnable && built.normalMap) {
      const reference = numberAt(values, "alphaReference", 0.5);
      const against = reference > 1 ? reference / 255 : reference;
      built.userData.cut = { bias: numberAt(values, "g_maskBias", 0), against };
      built.transparent = false;
    }
    materials[materials.length - 1].built = built;
    return compile(withDetail(built, spec?.values ?? {}));
  }
  return {
    texture,
    material,
    materials,
    painted,
    surfaces,
    arriving,
    /**
     * Free every map and every material this cursor made.
     *
     * **The deduplication is the reason it has to be here.** A texture is
     * shared between the materials that name it and a material between the
     * meshes that draw with it, so freeing them from the meshes would either
     * free one twice or, going carefully, free none. The cursor is the only
     * thing that knows how many there really were.
     */
    dispose() {
      for (const map of loaded.values()) map.dispose();
      loaded.clear();
      for (const entry of materials) entry.built?.dispose();
    },
  };
}
