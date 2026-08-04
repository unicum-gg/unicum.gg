/** Radius, in world metres, of a standard circular base capture zone. The game
 * stores no per-arena radius (arena_defs give only the centre point + a 100
 * capture-points limit); the size is baked into the shared capture-ring model
 * `Interface/CheckPoint/CheckPoint.model`, which is a 50 m radius (100 m across)
 * for every standard base and control point. Used to draw the zone to scale. */
export const BASE_CAPTURE_RADIUS_M = 50;

/** A point in world metres on the map plane. */
export type MapPoint = { x: number; z: number };

/** A point projected onto the minimap image, as percentages (0-100) from the
 * top-left, ready to position an absolutely-placed marker. */
export type MapMarker = { left: number; top: number };

/** Project a world point onto the minimap image (percent from the top-left). The
 * Z axis points "up" in world space but down in image space, so it is flipped. */
export function projectPoint(
  p: MapPoint,
  boundingBox: { bottomLeft: MapPoint; upperRight: MapPoint },
): MapMarker {
  const { bottomLeft: bl, upperRight: ur } = boundingBox;
  const width = ur.x - bl.x || 1;
  const height = ur.z - bl.z || 1;
  const left = ((p.x - bl.x) / width) * 100;
  const top = (1 - (p.z - bl.z) / height) * 100;
  return {
    left: Math.max(0, Math.min(100, left)),
    top: Math.max(0, Math.min(100, top)),
  };
}
