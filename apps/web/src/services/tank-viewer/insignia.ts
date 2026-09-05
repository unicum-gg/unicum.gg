// The marks of excellence, laid on the gun the way the client lays them.
//
// Its own file rather than a block inside the wardrobe: it is the one thing
// there that is not paint. Everything else the wardrobe does covers a surface,
// this projects a picture onto whatever surface a ray happens to cross, which
// is what lets one mark fit every barrel it is offered on.
import * as THREE from "three";

import { hasRay, project, stuckOn } from "./decals";
import { whenLoaded } from "./textures";
import type { Wardrobe } from "./styling";

/** What laying a mark needs of the vehicle it is going on. */
export type Marking = Pick<Wardrobe, "model" | "surfaces" | "first" | "texture"> & {
  /** The marks the style being worn brings, where it brings its own. */
  worn: () => string[];
  /** Where to keep what was laid, so it can come off again. */
  marked: THREE.Mesh[];
  strip: (list: THREE.Mesh[]) => void;
};


/**
 * Put marks of excellence on the gun, or take them off with 0.
 *
 * The client does not draw these into a texture: it hangs an
 * `insigniaOnGun` slot off the gun and projects the mark onto whatever
 * surface is there, which is how one mark fits every barrel it is offered
 * on. So this projects too, onto the gun's own mesh, one on each side.
 */
export async function markGun(
  { model, surfaces, first, texture, worn: brought, marked, strip }: Marking,
  count: number,
): Promise<void> {
  const worn = brought();
  strip(marked);
  // A style can bring its own marks. The slot on the gun is the vehicle's
  // either way, so only the picture changes.
  const set = worn.length > 0 ? worn : (model.marks ?? []);
  const at = set[Math.min(count, set.length) - 1];
  if (!count || !at) return;
  const gun = first("Gun");
  if (!gun) return;
  const slot = (model.slots?.[gun] ?? []).find((s) => s.kind === "insigniaOnGun");
  if (!slot || !hasRay(slot)) return;

  const map = await whenLoaded(texture({ path: at, colorSpace: "srgb" }));
  // **The height comes from the barrel, not from the slot's length.**
  //
  // A mark wraps the same arc of every gun it goes on, so its height has to
  // follow the tube's radius. Taking it from the slot's own length instead
  // holds on the IS-7 by luck, its barrel being thick, and turns the mark
  // into a band right round a thin one: the Panhard EBR's is 0.106 across
  // against a 0.7 box. Four radii is what the IS-7 already reads at, so it
  // keeps that and fixes the rest.
  // One per flank: the frame is mirrored on one of them, so the picture is
  // turned over there to land at the same place along the barrel.
  const painted: Record<number, THREE.MeshStandardMaterial> = {
    1: stuckOn(map),
    "-1": stuckOn(map, true),
  };

  // **A gun slot is not an emblem slot.** It carries no projection ray:
  // its ray runs along the barrel and says where the mark sits and how long
  // it is, and `rayUp` is the offset out to the barrel's own surface.
  const a = new THREE.Vector3().fromArray(slot.rayStart);
  const b = new THREE.Vector3().fromArray(slot.rayEnd);
  const up = new THREE.Vector3().fromArray(slot.rayUp);
  // **`rayStart` is the anchor, not one end of a span.**
  //
  // The ray's own length is 0.683 on this vehicle and so is `size`, and a
  // slot that carried both would be saying the same thing twice. Reading
  // the segment as the mark's extent put it half a size too far towards the
  // muzzle against the game. So the ray gives a point and a direction, the
  // size gives the length, and the mark is centred on the point.
  const middle = a.clone();
  const along = new THREE.Vector3().subVectors(b, a).normalize();
  const reach = up.length();
  // **The height comes from the barrel, not from the slot's length.**
  //
  // A mark wraps the same arc of every gun it goes on, so its height has to
  // follow the tube's radius. Taking it from the slot's own length instead
  // holds on the IS-7 by luck, its barrel being thick, and turns the mark
  // into a band right round a thin one: the Panhard EBR's is 0.106 across
  // against a 0.7 box. Four radii is what the IS-7 already reads at, so it
  // keeps that and fixes the rest.
  const tall = reach * 4;
  // Both flanks. The client carries one slot and puts the mark on either
  // side of the barrel, which is how it reads from wherever you stand.
  for (const side of [1, -1]) {
    const facing = up.clone().normalize().multiplyScalar(side);
    const on = middle.clone().add(facing.clone().multiplyScalar(reach));
    // **Up is up on both flanks.** Taking the barrel's own axis as the
    // decal's sideways and letting the third vector fall out of the other
    // two gives a frame that is upright on one flank and upside down on the
    // other, which on a star reads as a mark printed backwards. So up is
    // fixed and it is sideways that follows, which flips with the side and
    // is exactly what makes the mark read the same way round from either
    // side of the tank.
    const upright = new THREE.Vector3(0, 1, 0).addScaledVector(facing, -facing.y);
    if (upright.lengthSq() < 1e-6) upright.copy(along);
    upright.normalize();
    const across = new THREE.Vector3().crossVectors(upright, facing);
    const turn = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, upright, facing));
    // Sideways is along the barrel now, so the mark's own width is the
    // slot's size and its height is what its picture asks for.
    const size = new THREE.Vector3(slot.size, tall, reach * 2.2);
    for (const mesh of surfaces.get(gun) ?? []) {
      const decal = project(mesh, on, turn, size, painted[side], facing);
      if (decal) marked.push(decal);
    }
  }
}
