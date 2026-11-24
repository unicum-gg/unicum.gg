// The pieces the armour model has nothing for, kept faintly in its views.
//
// The spider's legs are the case: the client ships them as visuals alone, with
// no collision model behind them, so the armour views drew the invisible track
// boxes its chassis is built on and nothing else below the hull. A shell cannot
// hit a leg, which the views say honestly, but a reader no longer recognised the
// vehicle. So the legs stay on screen in the grey everything that is not armour
// reads in, translucent, and the plates are drawn over them.
//
// They live on the default layer, which the armour views draw first with the
// floor, so the composed plates cover them wherever there is armour in front.
// Unlit, because those views take the studio lights off with the visual model.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { NOT_ARMOUR } from "./armour/colours";

const OPACITY = 0.35;

export function ghostMaterial() {
  return new THREE.MeshBasicMaterial({
    color: NOT_ARMOUR,
    transparent: true,
    opacity: OPACITY,
  });
}

/**
 * A copy of a dressed piece in the ghost material, hidden until the armour is.
 *
 * Shares the original's geometry, so it costs a draw call and no buffers.
 */
export function ghostOf(original: THREE.Object3D, material: THREE.Material) {
  const ghost = cloneSkinned(original);
  ghost.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    mesh.material = material;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  ghost.visible = false;
  return ghost;
}
