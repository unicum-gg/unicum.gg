// How the vehicle is dressed.
//
// The customization system is its own concern: a camouflage laid on some parts,
// a paint under it on the rest, decals projected into the slots the vehicle
// carries, and the marks of excellence on the gun. It reads the vehicle the
// loader built rather than building anything, so it is given what it needs and
// hands back the two switches a caller works it with.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import type {
  MirrorCamouflage,
  MirrorColour,
  MirrorModel,
  MirrorOutfit,
  MirrorSlot,
  MirrorStyle,
  MirrorTexture,
} from "@unicum.gg/wargaming";

import { frameOf, hasRay, partOf, project, stuckOn } from "./decals";
import { markGun } from "./insignia";
import type { PaintedMaterial } from "./shader";
import { BLANK, FLAT, whenLoaded } from "./textures";

/** What dressing a vehicle needs of the vehicle the loader built. */
export type Wardrobe = {
  model: MirrorModel;
  scene: THREE.Scene;
  /** Reads a texture from the mirror, cached, at the loaded definition. */
  texture: {
    (entry: MirrorTexture): THREE.Texture;
    (entry: MirrorTexture | undefined | null): THREE.Texture | null;
  };
  /** The meshes each piece drew with, for anything projected onto them. */
  surfaces: Map<string, THREE.Mesh[]>;
  /** Every material that can take paint, with the part it belongs to. */
  painted: PaintedMaterial[];
  /** The first piece whose name starts with a prefix, as a stock loadout. */
  first: (prefix: string) => string | undefined;
};

/**
 * The camouflage, the paint, the decals and the marks, as two switches.
 *
 * Nothing here recompiles a material: every one that can take paint was built
 * able to, so putting a style on is a handful of uniforms.
 */
export function wardrobe({ model, scene, texture, surfaces, painted, first }: Wardrobe) {
  /** The marks the style being worn brings, if it brings any of its own. */
  let worn: string[] = [];
  /** How many marks are on the gun, so a change of style can put them back. */
  let showing = 0;
  /** What is projected onto the vehicle, kept so it can come off again. */
  const marked: THREE.Mesh[] = [];
  const stuck: THREE.Mesh[] = [];
  const strip = (list: THREE.Mesh[]) => {
    for (const decal of list) {
      decal.parent?.remove(decal);
      decal.geometry.dispose();
    }
    list.length = 0;
  };

  /**
   * How big a camouflage is laid on one piece, and where its pattern starts.
   *
   * **The client has two paths and they are not variants of one formula.** A
   * camouflage that carries a tiling tuned by hand for this vehicle uses it,
   * multiplied by the piece's own coefficient. One that does not is computed
   * from its factor, the pattern's own pixel size, the vehicle's length and the
   * piece's density, and the hand-tuned coefficient plays no part.
   *
   * Reading the second kind's factor as if it were the first kind's tiling is
   * what put "Come Get Some!" at the wrong size, and no amount of arguing about
   * whether the piece coefficient multiplies or divides could have fixed it:
   * that coefficient was not in the formula at all.
   */
  function layOut(camouflage: MirrorCamouflage, piece: string) {
    const own = model.camouflage?.[piece];
    if (camouflage.tiling) {
      const [u, v, du, dv] = camouflage.tiling;
      const coefficient = own?.tiling;
      return new THREE.Vector4(
        u * (coefficient?.[0] ?? 1),
        v * (coefficient?.[1] ?? 1),
        du + (coefficient?.[2] ?? 0),
        dv + (coefficient?.[3] ?? 0),
      );
    }
    const [width, height] = camouflage.size ?? [512, 512];
    const [factorU, factorV] = camouflage.factor ?? [1, 1];
    const [densityU, densityV] = own?.density ?? [1, 1];
    const [aoU, aoV] = own?.aoTextureSize ?? [width, height];
    const [stretchU, stretchV] = model.camouflageDensity ?? [1, 1];
    const absolute = camouflage.tilingType === "absolute";
    // `relativeWithFactor` also takes the vehicle's own stretch; plain
    // `relative` does not.
    const withFactor = camouflage.tilingType === "relativewithfactor";
    const length = vehicleLength();
    const along = absolute ? factorU : ((width * factorU) / length) * (withFactor ? stretchU : 1);
    const around = absolute ? factorV : ((height * factorV) / length) * (withFactor ? stretchV : 1);
    const scale = camouflage.scale ?? 1;
    return new THREE.Vector4(
      ((aoU / width) * along * scale) / (densityU || 1),
      ((aoV / height) * around * scale) / (densityV || 1),
      camouflage.offset?.[0] ?? 0,
      camouflage.offset?.[1] ?? 0,
    );
  }

  /**
   * How long the vehicle is, which the computed tiling divides by so a pattern
   * reads at the same size on a scout and on a heavy. Measured off the body
   * rather than the gun: a barrel is not what a camouflage is scaled against.
   */
  let measured = 0;
  function vehicleLength() {
    if (measured > 0) return measured;
    const box = new THREE.Box3();
    for (const name of [first("Hull"), first("Chassis")]) {
      if (!name) continue;
      for (const mesh of surfaces.get(name) ?? []) box.expandByObject(mesh);
    }
    measured = Math.max(1, box.max.z - box.min.z);
    return measured;
  }

  /**
   * The decals a style projects into the vehicle's own projection slots.
   *
   * These are not placed by casting a ray like an emblem: the slot carries a
   * box, a position, a turn and a size, and the item says which slots it may go
   * in by naming their tags. `safe left formfactor_square` picks out one place
   * on a vehicle and no other, so matching is a subset test and nothing more.
   */
  async function projected(outfit: MirrorOutfit | null) {
    // The slot is in the vehicle's space and has to be brought into the mesh's,
    // which means the mesh has to know where it is. A style can go on before
    // anything has been drawn, and an un-updated world matrix reads as the
    // identity: the decal then lands at the vehicle's origin, inside the hull,
    // and clips against nothing.
    scene.updateMatrixWorld(true);
    for (const decal of outfit?.projected ?? []) {
      const map = await whenLoaded(texture({ path: decal.texture, colorSpace: "srgb" }));
      const material = stuckOn(map);
      for (const [piece, slots] of Object.entries<MirrorSlot[]>(model.slots ?? {})) {
        for (const slot of slots) {
          if (slot.kind !== "projectionDecal" || !slot.position || !slot.scale) continue;
          if (slot.model || !decal.tags.every((tag: string) => slot.tags?.includes(tag))) continue;
          // **A projection slot is given in the vehicle's space, not the
          // piece's.** An emblem slot is piece-local, and reading these the same
          // way put the turret's decals in the air above its roof: their heights
          // are measured from the ground, so a turret slot at 1.91 is low on its
          // flank rather than up at its cupola.
          //
          // **Its rotation names two axes rather than orienting a box**, and it
          // is read in YXZ: the normal is its own -Y and the up is its own -Z.
          // Each is mirrored on its own afterwards, which is not the same as
          // mirroring the three angles and then rotating.
          const [pitch, yaw, roll] = slot.rotation ?? [0, 0, 0];
          const frame = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(pitch, yaw, roll, "YXZ"),
          );
          const outward = new THREE.Vector3(0, -1, 0).applyQuaternion(frame);
          const upright = new THREE.Vector3(0, 0, -1).applyQuaternion(frame);
          outward.x *= -1;
          upright.x *= -1;
          // **The picture is X by Z and the thickness is Y**, and the size the
          // style asks for scales the picture alone. `scaleFactorId` counts from
          // one, which is why the client's own default is 3 for a list of three:
          // taking it as an index left every decal a quarter too big.
          const [wide, thick, tall] = slot.scale;
          const size = new THREE.Vector3(wide * decal.scale, tall * decal.scale, thick);
          for (const mesh of surfaces.get(piece) ?? []) {
            const toMesh = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
            const at = new THREE.Vector3().fromArray(slot.position).applyMatrix4(toMesh);
            const normal = outward.clone().transformDirection(toMesh).normalize();
            const up = upright.clone().transformDirection(toMesh).normalize();
            const right = new THREE.Vector3().crossVectors(up, normal);
            const turn = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
            const laid = project(mesh, at, turn, size, material, normal);
            if (laid) stuck.push(laid);
          }
        }
      }
    }
  }

  /**
   * The stickers and the lettering a style carries.
   *
   * These are not painted on: the vehicle carries slots for them, and which one
   * a decal lands in comes from what it is rather than from where it is
   * pointed. The client keeps emblem slots and inscription slots apart on every
   * piece, so an emblem goes in an emblem slot and a line of lettering goes in
   * an inscription slot, on whichever pieces the style names.
   */
  async function sticker(outfit: MirrorOutfit | null) {
    strip(stuck);
    await projected(outfit);
    for (const decal of outfit?.decals ?? []) {
      const map = await whenLoaded(texture({ path: decal.texture, colorSpace: "srgb" }));
      const material = stuckOn(map);
      const wanted = decal.kind === "inscription" ? ["inscription"] : ["player", "clan"];
      for (const [piece, slots] of Object.entries<MirrorSlot[]>(model.slots ?? {})) {
        // A decal lands in a slot rather than on a region, so what matters is
        // only whether the style names this piece at all.
        if (!decal.regions[partOf(piece)]) continue;
        for (const slot of slots) {
          if (!wanted.includes(slot.kind) || !hasRay(slot)) continue;
          // A slot that belongs to one 3D style is not a slot on the vehicle.
          if (slot.model) continue;
          const { at, turn, depth, outward } = frameOf(slot);
          const tall = (slot.size * map.image.height) / map.image.width;
          const size = new THREE.Vector3(slot.size, tall, Math.max(depth, slot.size));
          for (const mesh of surfaces.get(piece) ?? []) {
            const laid = project(mesh, at, turn, size, material, outward);
            if (laid) stuck.push(laid);
          }
        }
      }
    }
  }
  async function mark(count: number) {
    showing = count;
    await markGun(
      { model, surfaces, first, texture, worn: () => worn, marked, strip },
      count,
    );
  }

  /**
   * Put a 2D style on, or take it off with `null`.
   *
   * A style is a recipe rather than a picture: a camouflage on some parts, a
   * paint on others, each with its own colours. So it is read part by part,
   * the camouflage first where it reaches and the paint under it everywhere
   * else. Nothing recompiles: every material that can take paint was built
   * able to, so a click is a handful of uniforms.
   */
  async function wear(style: MirrorStyle | null, season: string) {
    const outfit = style
      ? style.outfits.find((o) => o.season === season) ?? style.outfits[0]
      : null;
    const linear = (c: MirrorColour) =>
      // The client writes paint as sRGB bytes and the shader works in linear,
      // so the conversion happens here rather than in a texture's colour space.
      new THREE.Color().setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace);

    for (const { uniforms, part, piece } of painted) {
      const regions = outfit?.regionColors?.[part];
      if (!regions) {
        uniforms.camoCover.value = 0;
        continue;
      }
      // Every region takes a colour, whether or not the style named it.
      [uniforms.camoRegionA, uniforms.camoRegionB, uniforms.camoRegionC, uniforms.camoRegionD].forEach((slot, i) => {
        const colour = regions[i];
        if (!colour) return slot.value.set(0, 0, 0, 0);
        const { r, g, b } = linear(colour);
        slot.value.set(r, g, b, colour.a / 255);
      });
      // And its finish, which is what separates a lacquered coat from a matt
      // one under the same colour.
      const finish = outfit?.regionFinish?.[part] ?? [];
      uniforms.camoPaintGloss.value.fromArray([0, 1, 2, 3].map((i) => finish[i]?.gloss ?? 0.509));
      uniforms.camoPaintMetal.value.fromArray([0, 1, 2, 3].map((i) => finish[i]?.metallic ?? 0.23));

      // A style can wear a different pattern on each part, so the one this
      // piece takes is the one that names it.
      //
      // **A camouflage covers the whole piece, not one of its regions.** The
      // client's `GUN_CAMOUFLAGE_REGIONS = (GUN,)` and its siblings read like
      // a rendering mask and are not one: they say a player has exactly one
      // camouflage slot per part, against three paint slots, which is why a
      // camouflage's `appliedTo` only ever names each part's first region.
      // The regions are how the paints are told apart.
      const camouflage = (outfit.camouflages ?? []).find((c) => c.regions[part]) ?? null;
      uniforms.camoColors.value.forEach((slot: THREE.Vector4) => slot.set(0, 0, 0, 0));
      uniforms.camoPattern.value = BLANK;
      uniforms.camoGlossSet.value.set(0.509, 0.509, 0.509, 0.509);
      uniforms.camoMetalSet.value.set(0.23, 0.23, 0.23, 0.23);
      uniforms.camoGlossMetalMap.value = BLANK;
      uniforms.camoHasGlossMetal.value = 0;
      uniforms.camoNormalMap.value = FLAT;
      uniforms.camoNormalStrength.value = 0;
      uniforms.camoEmissionMap.value = BLANK;
      uniforms.camoEmissionPower.value = 0;
      if (camouflage) {
        uniforms.camoPattern.value = texture({ path: camouflage.texture, colorSpace: "linear" }) ?? BLANK;
        uniforms.camoTiling.value.copy(layOut(camouflage, piece));
        uniforms.camoTurn.value = camouflage.rotation?.[part] ?? 0;
        // **A pattern with a padded alpha has three weights, not four.**
        // Where the client ships one in a three-channel block format the
        // alpha decodes to a flat 255, and laying the palette's fourth colour
        // through it covers the whole surface at full weight: it both tints
        // the piece and, because the weights are what the colour is divided
        // by, halves everything else. 277 of 400 of the client's patterns are
        // padded that way, so the conversion counts the real ones and the
        // fourth slot is simply not laid where there is nothing to lay it by.
        const carried = camouflage.weights ?? 4;
        uniforms.camoColors.value.forEach((slot, i) => {
          const c = camouflage.colors[i];
          if (!c || i >= carried) return;
          const { r, g, b } = linear(c);
          slot.set(r, g, b, c.a / 255);
        });
        // The coat's own finish. Gloss and metal are linear numbers rather
        // than colours, so they go in as they are written.
        if (camouflage.gloss) uniforms.camoGlossSet.value.fromArray(camouflage.gloss);
        if (camouflage.metallic) uniforms.camoMetalSet.value.fromArray(camouflage.metallic);
        if (camouflage.glossMetallicMap) {
          uniforms.camoGlossMetalMap.value = texture({ path: camouflage.glossMetallicMap, colorSpace: "linear" });
          uniforms.camoHasGlossMetal.value = 1;
        }
        if (camouflage.normal) {
          uniforms.camoNormalMap.value = texture({ path: camouflage.normal.texture, colorSpace: "linear" });
          uniforms.camoNormalStrength.value = camouflage.normal.strength ?? 1;
        }
        if (camouflage.emission) {
          uniforms.camoEmissionMap.value = texture({ path: camouflage.emission.texture, colorSpace: "srgb" });
          uniforms.camoEmissionPower.value = camouflage.emission.power ?? 1;
        }
      }
      uniforms.camoCover.value = 1;
    }
    await sticker(outfit);
    // The marks may be this style's own, so whatever is on the gun is put
    // back with the style's own picture.
    const before = worn;
    worn = outfit?.marks ?? [];
    if (before.join() !== worn.join() && showing > 0) await mark(showing);
  }

  return { mark, wear };
}
