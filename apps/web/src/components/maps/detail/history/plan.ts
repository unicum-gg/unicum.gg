import {
  MAP_AREA_MAP,
  MAP_AREA_ONSLAUGHT,
  MAP_VARIANT_PREFIX,
  mapChangeArea,
  type MapChangeArea,
  type MapDetail,
  type MapVariantLayout,
} from "@unicum.gg/shared";
import type { FormattedMapChange } from "@/components/maps/change-format";

/**
 * What an area's minimap would draw, and whether there is anything to draw at
 * all.
 *
 * Its own module rather than part of the drawing next door, because the panel
 * that asks the question renders on the server while the drawing is a client
 * component. A `"use client"` module exports client REFERENCES, so a server
 * component importing a plain function from one is handed a stub and gets
 * "attempted to call it from the server" at the one reader who opens the page.
 * Nothing here touches the browser, so nothing here belongs behind that
 * boundary.
 */

/** The space an area is drawn on: the map's own Onslaught layout, a variant's
 * (its Onslaught one when it has one, else the variant arena itself), or null
 * for the map, which draws on its own minimap. */
function spaceFor(
  detail: MapDetail,
  area: MapChangeArea,
): {
  arenaId: string;
  minimapUrl: string;
  widthMeters: number;
  heightMeters: number;
} | null {
  if (area === MAP_AREA_ONSLAUGHT) return detail.onslaught;
  if (!area.startsWith(MAP_VARIANT_PREFIX)) return null;
  const battleType = area.slice(MAP_VARIANT_PREFIX.length);
  const variant = detail.variants.find(
    (v: MapVariantLayout) => v.battleType === battleType,
  );
  if (!variant) return null;
  return variant.onslaught ?? variant;
}

/**
 * What this area's minimap would draw, or null when there is nothing to draw.
 *
 * Nothing to draw means: no marker moved, the map has no play area to project
 * onto, or the area asked for is Onslaught on a map that no longer has one. That
 * last case is why the area is passed in rather than guessed from the markers:
 * an Onslaught spawn drawn over the full map would be pointing at a place on a
 * different image, at a different scale.
 */
export function plan(
  detail: MapDetail,
  changes: FormattedMapChange[],
  area: MapChangeArea,
) {
  // The area a change belongs to is what the shared vocabulary says, so the
  // three of them (the map, Onslaught, and the night arena) are told apart the
  // same way here as in the rows beside this minimap.
  const geometry = changes.filter(
    (c) => c.markers && mapChangeArea(c.field) === area,
  );
  if (geometry.length === 0) return null;
  // Each area draws on its own space: the map's, its Onslaught layout's, or a
  // variant's, which is a different arena again.
  const space = spaceFor(detail, area);
  if (area !== MAP_AREA_MAP && !space) return null;
  const width = space?.widthMeters ?? detail.widthMeters;
  const height = space?.heightMeters ?? detail.heightMeters;
  if (width <= 0 || height <= 0) return null;
  return { geometry, onslaught: space, width, height };
}

export type VersionPlan = NonNullable<ReturnType<typeof plan>>;

/** Whether this area has a minimap to draw for these changes. */
export function hasVersionMinimap(
  detail: MapDetail,
  changes: FormattedMapChange[],
  area: MapChangeArea,
): boolean {
  return plan(detail, changes, area) !== null;
}
