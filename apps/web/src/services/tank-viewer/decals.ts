// Marks, emblems and inscriptions, projected onto the vehicle.
//
// The client places these by casting a ray rather than by drawing them into a
// texture, which is how a mark of excellence wraps a gun barrel and an emblem
// sits flat on a sloped plate.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { MirrorSlot } from "@unicum.gg/wargaming";

/** A slot the client gave a ray, which is what `frameOf` can read. */
export type RaySlot = MirrorSlot & { rayStart: number[]; rayEnd: number[]; rayUp: number[] };

export const hasRay = (slot: MirrorSlot): slot is RaySlot =>
  Boolean(slot.rayStart && slot.rayEnd && slot.rayUp);

/**
 * Lay a decal on a piece, in the piece's own space.
 *
 * `DecalGeometry` reads its target's world matrix, and everything the client
 * places is given relative to the vehicle. Lending it the identity for the
 * length of the call keeps the result in the piece's own space, so the decal
 * can hang off the mesh and follow it as the turret turns and the gun aims.
 */
export function project(
  mesh: THREE.Mesh,
  at: THREE.Vector3,
  turn: THREE.Euler,
  size: THREE.Vector3,
  material: THREE.Material,
  facing: THREE.Vector3 | null,
) {
  const world = mesh.matrixWorld.clone();
  mesh.matrixWorld.identity();
  const geometry = clipToFacing(new DecalGeometry(mesh, at, turn, size), facing);
  mesh.matrixWorld.copy(world);
  // A slot can point at a piece that has nothing where it points, which is
  // normal: the client offers the same slot on a vehicle and on its styles.
  if (geometry.attributes.position.count === 0) {
    geometry.dispose();
    return null;
  }
  const decal = new THREE.Mesh(geometry, material);
  decal.renderOrder = 1;
  mesh.add(decal);
  return decal;
}

/**
 * Keep only the triangles that face the projector.
 *
 * **A decal box does not stop at the horizon.** On a gun barrel that is what
 * bites: the Panhard EBR's barrel is 0.106 across and a mark's box is 0.7 tall,
 * so the box passes right through and takes the far side of the tube with it,
 * and the mark comes out in pieces. The client guards against this with a
 * `clipAngle` on the slot and drops whatever faces away, which is what this
 * does. The IS-7 never showed it because its barrel is half again as thick.
 *
 * **The limit is barely off zero on purpose.** Anything stricter carves an arc
 * out of each flank rather than a hemisphere, and a mark that runs right round
 * a barrel then meets its own other half with a gap between them: at seventy
 * five degrees the two halves cover three hundred and leave sixty of bare tube
 * along the top. Facing the projector at all is the whole of the test.
 */
export function clipToFacing(
  geometry: THREE.BufferGeometry,
  facing: THREE.Vector3 | null,
  limit = 0.02,
) {
  if (!facing) return geometry;
  const normal = geometry.getAttribute("normal");
  const kept = [];
  for (let i = 0; i < normal.count; i += 3) {
    const towards =
      (normal.getX(i) + normal.getX(i + 1) + normal.getX(i + 2)) * facing.x +
      (normal.getY(i) + normal.getY(i + 1) + normal.getY(i + 2)) * facing.y +
      (normal.getZ(i) + normal.getZ(i + 1) + normal.getZ(i + 2)) * facing.z;
    if (towards / 3 > limit) kept.push(i);
  }
  if (kept.length * 3 === normal.count) return geometry;
  const trimmed = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const from = geometry.getAttribute(name);
    if (!from) continue;
    const width = from.itemSize;
    const out = new Float32Array(kept.length * 3 * width);
    kept.forEach((start, at) => {
      for (let v = 0; v < 3; v++) {
        for (let c = 0; c < width; c++) out[(at * 3 + v) * width + c] = from.array[(start + v) * width + c];
      }
    });
    trimmed.setAttribute(name, new THREE.BufferAttribute(out, width));
  }
  geometry.dispose();
  return trimmed;
}

/**
 * A material for something laid on top of a surface it shares.
 *
 * **The picture goes on the other way up.** Every texture the mirror publishes
 * is loaded `flipY: false`, because the model's own UVs are stored the way glTF
 * reads them. A decal's UVs are not the model's: they are generated here, in
 * three's own convention, so the texture has to be turned back the right way or
 * an inscription comes out reading backwards.
 */
export function stuckOn(source: THREE.Texture, mirrored = false): THREE.MeshStandardMaterial {
  const map = source.clone();
  map.flipY = true;
  // **Mirrored where the frame is.** A decal box has to be right-handed, so
  // fixing which way is up forces the sideways axis to flip between a
  // vehicle's two flanks. Left alone that puts the same picture at opposite
  // ends of a gun barrel, and a mark that runs right round it, as the French
  // and British ones do, comes out as a staggered zigzag rather than as rings.
  // Turning the picture over on that side puts the ink back at the same place
  // along the barrel and still leaves it the right way up.
  if (mirrored) {
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.x = -1;
    map.offset.x = 1;
  }
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    depthWrite: false,
    // A decal shares its surface with the plate under it, so it has to be told
    // which of the two is in front.
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: 0.75,
    metalness: 0,
  });
}

/**
 * The frame an emblem or inscription slot projects in.
 *
 * These carry a ray that starts outside the vehicle and ends inside it, so the
 * ray is the direction to project along and whatever surface it crosses is what
 * gets marked. `rayUp` is which way is up on the picture, which has to be
 * squared against the ray rather than taken as given.
 */
export function frameOf(slot: RaySlot) {
  const a = new THREE.Vector3().fromArray(slot.rayStart);
  const b = new THREE.Vector3().fromArray(slot.rayEnd);
  const outward = new THREE.Vector3().subVectors(a, b).normalize();
  const up = new THREE.Vector3().fromArray(slot.rayUp);
  const squared = up.clone().addScaledVector(outward, -up.dot(outward));
  if (squared.lengthSq() < 1e-6) squared.set(0, 1, 0).addScaledVector(outward, -outward.y);
  squared.normalize();
  const across = new THREE.Vector3().crossVectors(squared, outward);
  return {
    at: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
    turn: new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, squared, outward)),
    depth: a.distanceTo(b) * 2,
    outward,
  };
}

/** Which of the four parts a style paints a piece belongs to. */
export function partOf(name: string) {
  if (name.startsWith("Turret")) return "turret";
  if (name.startsWith("Gun")) return "gun";
  if (name.startsWith("Hull")) return "hull";
  return "chassis";
}

