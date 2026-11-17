// Sliding the texture along the ribbon a chassis carries, for a vehicle with no
// belt to lay.
//
// A dozen tracked vehicles ship no link or no path, so the ribbon is all there
// is, and it stood still while the wheels turned. It cannot be deformed (each
// vertex is bound to one bone at full weight, see `running-gear`), but it does
// not need to be: the client scrolls its texture, and so does this.
//
// Its source of truth stays `unicum-gg/wot.build`, `preview/visual.js`.
import * as THREE from "three";

/** The ribbon baked into a vehicle's own meshes. */
const RIBBON = /^track_/;

const isMesh = (o: THREE.Object3D): o is THREE.Mesh =>
  (o as THREE.Mesh).isMesh === true;

type Rate = { axis: 0 | 1; slope: number };

/**
 * How far the texture moves per metre the tank travels, read off the ribbon.
 *
 * **Measured along its bottom run, edge by edge.** That is where the belt lies
 * flat on the ground, so the coordinate that changes with Z there is the one
 * running along the belt. A ribbon is textured in stretches that each start
 * their texture over, so the coordinate is a saw and a line fitted through all
 * of it measures nothing (the M41's correlates at 0.17), while every edge
 * lying along the run says the same thing locally: their median is the rate.
 */
function rateOf(mesh: THREE.Mesh, ground: number): Rate | null {
  const pos = mesh.geometry.getAttribute("position");
  const uv = mesh.geometry.getAttribute("uv");
  const index = mesh.geometry.index;
  if (!pos || !uv || !index) return null;
  const slopes: [number[], number[]] = [[], []];
  for (let t = 0; t + 2 < index.count; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = index.getX(t + e);
      const j = index.getX(t + ((e + 1) % 3));
      if (pos.getY(i) > ground || pos.getY(j) > ground) continue;
      const dz = pos.getZ(j) - pos.getZ(i);
      if (Math.abs(dz) < 0.01) continue;
      slopes[0].push((uv.getX(j) - uv.getX(i)) / dz);
      slopes[1].push((uv.getY(j) - uv.getY(i)) / dz);
    }
  }
  if (slopes[0].length < 8) return null;
  const median = (list: number[]) =>
    [...list].sort((x, y) => x - y)[list.length >> 1];
  const rates = [median(slopes[0]), median(slopes[1])];
  const axis = Math.abs(rates[1]) > Math.abs(rates[0]) ? 1 : 0;
  return rates[axis] !== 0 ? { axis, slope: rates[axis] } : null;
}

/**
 * Scroll the ribbons among these parts as though the tank had travelled.
 *
 * The bottom of a belt stands still on the ground while the tank moves
 * forward, so after a distance `d` the point under Z shows what was under
 * `Z + d`: the coordinate moves by the rate times `d`. Null when there is no
 * ribbon to run, so the caller can tell.
 */
export function ribbonScroller(
  parts: THREE.Object3D[],
): ((distance: number) => void) | null {
  const meshes: THREE.Mesh[] = [];
  for (const part of parts) {
    part.traverse((o) => {
      if (isMesh(o) && o.visible && RIBBON.test(o.name)) meshes.push(o);
    });
  }
  if (meshes.length === 0) return null;
  let floor = Infinity;
  let top = -Infinity;
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      floor = Math.min(floor, pos.getY(i));
      top = Math.max(top, pos.getY(i));
    }
  }
  // The bottom run, as the lowest tenth of the belt's height.
  const ground = floor + (top - floor) * 0.1;
  const measured = meshes.map((mesh) => {
    mesh.geometry.computeBoundingBox();
    const centre = mesh.geometry.boundingBox?.getCenter(new THREE.Vector3());
    return { mesh, side: Math.sign(centre?.x ?? 0), rate: rateOf(mesh, ground) };
  });
  const runs: {
    uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
    rest: Float32Array;
    rate: Rate;
  }[] = [];
  for (const { mesh, side, rate } of measured) {
    // A ribbon split into pieces may leave one with nothing on the ground,
    // which takes the rate its side measured.
    const found =
      rate ??
      measured.find((o) => o.rate && o.side === side)?.rate ??
      measured.find((o) => o.rate)?.rate;
    if (!found) continue;
    const uv = mesh.geometry.getAttribute("uv");
    const rest = Float32Array.from({ length: uv.count }, (_, i) =>
      found.axis === 0 ? uv.getX(i) : uv.getY(i),
    );
    runs.push({ uv, rest, rate: found });
  }
  if (runs.length === 0) return null;
  return (distance) => {
    for (const { uv, rest, rate } of runs) {
      for (let i = 0; i < uv.count; i++) {
        const at = rest[i] + rate.slope * distance;
        if (rate.axis === 0) uv.setX(i, at);
        else uv.setY(i, at);
      }
      uv.needsUpdate = true;
    }
  };
}
