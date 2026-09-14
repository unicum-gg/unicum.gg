// What a piece of geometry has to survive before anything is measured off it.
//
// The mirror publishes what the client ships, and the client ships the odd
// vertex that is not a number. The Triumphant's 3D style is one: seven of the
// 3,888 vertices in its track ribbon are NaN, against a clean file on the plain
// Centurion Action X the style is worn over.
//
// **Seven vertices took the whole vehicle off the page.** Nothing draws a NaN
// triangle, so the ribbon itself was never the loss, and the ribbon is hidden
// anyway once the real belt is laid over it. What it reached was the framing:
// the bounding box of a mesh holding one NaN is NaN in every direction, the
// camera is placed at the centre of that box, and a camera at NaN looks at
// nothing from nowhere. The hero came up empty, with no error in the console
// and every byte of the vehicle correctly downloaded.
//
// So it is mended at the door rather than guarded against at each measurement:
// the box is only the first thing that would have read it, and the decals, the
// armour fit and the collision hull all measure the same vertices later.

import type * as THREE from "three";

/**
 * Pull every vertex that is not a number onto one that is.
 *
 * Collapsing rather than dropping, because an index buffer names positions by
 * number: removing one renumbers every vertex after it and rewrites every face
 * that mentions them. Folding the bad ones onto a good one leaves the numbering
 * alone and turns the handful of faces that used them into degenerate
 * triangles, which the renderer draws as nothing at all, which is what a vertex
 * with no position was always going to be worth.
 *
 * Returns how many were mended, so a caller can say so once for the vehicle
 * rather than once per piece.
 */
export function mendPositions(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute("position");
  if (!position) return 0;
  const values = position.array as ArrayLike<number> & { [i: number]: number };
  // A first pass that reads and writes nothing, since this runs over every
  // mesh of every vehicle and all but a handful are clean.
  let broken = 0;
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i]!)) broken++;
  }
  if (broken === 0) return 0;
  const stride = position.itemSize;
  const sound = (at: number) => {
    for (let i = 0; i < stride; i++) {
      if (!Number.isFinite(values[at * stride + i]!)) return false;
    }
    return true;
  };
  let anchor = -1;
  for (let v = 0; v < position.count; v++) {
    if (sound(v)) {
      anchor = v;
      break;
    }
  }
  let mended = 0;
  for (let v = 0; v < position.count; v++) {
    if (sound(v)) continue;
    mended++;
    for (let i = 0; i < stride; i++) {
      // A mesh with no sound vertex at all has nothing to fold onto, and the
      // origin is the one place that cannot drag the box: it is inside the
      // vehicle by construction.
      values[v * stride + i] = anchor < 0 ? 0 : values[anchor * stride + i]!;
    }
  }
  position.needsUpdate = true;
  // Both are computed lazily and cached, so a box taken before the mend would
  // outlive it.
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
  return mended;
}
