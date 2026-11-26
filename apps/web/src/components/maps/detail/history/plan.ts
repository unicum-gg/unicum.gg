import {
  MAP_AREA_MAP,
  MAP_AREA_ONSLAUGHT,
  MAP_VARIANT_PREFIX,
  MAP_VISUAL_HISTORY_START,
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

/** The minimap a version's markers are drawn on: the one in the game at that
 * version; else the last one known before it, named by its own version
 * (`nearest`); else the latest one, flagged. */
export type VersionMinimapImage = {
  src: string | null;
  latest: boolean;
  /** Set when the image is not that version's but the last one known before. */
  nearest?: string;
};

/** `1.19.1` against `1.9.0`, numerically: a string comparison puts 1.19 first. */
/** Update 1.0 rebuilt every map in HD, many of them with a new layout. */
const HD_REWORK = "1.0.0";

export function compareGameVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * For each version, newest first, the minimap its changes were made on.
 *
 * Today's minimap is the right picture back to the last time it was redrawn,
 * and every redraw since the archive starts is a row holding the image before
 * it. So walking back from the newest version, a redraw hands its older image
 * to every version below it, until the next redraw. Before the installs start,
 * the archived full clients (0.6.2 to 0.9.7, and 1.15.0) left one image per
 * redraw (`legacy`), the newest at or below a version being the one it was
 * played on, as long as the version is within what that image is known to
 * hold for (`through`). Where nothing survives (0.9.8 to 1.14), a version is
 * drawn on the last image known before it, and the picture names that image's
 * version, except across update 1.0, which rebuilt every map: a version after
 * it whose last known image is from before takes the first HD image instead
 * (1.15.0), the map it was really played on far more likely than the 2014 one.
 * Only with no image before it at all does a version keep the latest one,
 * flagged. `src` null means the map's own current image.
 */
export function minimapEras(
  versions: { gameVersion: string; changes: FormattedMapChange[] }[],
  legacy: { version: string; through: string; url: string }[] = [],
): Map<string, VersionMinimapImage> {
  const out = new Map<string, VersionMinimapImage>();
  let era: string | null = null;
  for (const { gameVersion, changes } of versions) {
    if (compareGameVersions(gameVersion, MAP_VISUAL_HISTORY_START) < 0) {
      const newest = legacy.findLast((m) => compareGameVersions(m.version, gameVersion) <= 0);
      const drawn =
        newest && compareGameVersions(gameVersion, newest.through) <= 0 ? newest : undefined;
      // The last image before the version, unless update 1.0 lies between the
      // two: it rebuilt every map, so an SD image says nothing about an HD
      // version, and the first HD image after it is the closer picture.
      const crossesRework =
        newest &&
        compareGameVersions(gameVersion, HD_REWORK) >= 0 &&
        compareGameVersions(newest.version, HD_REWORK) < 0;
      const fallback = crossesRework
        ? (legacy.find((m) => compareGameVersions(m.version, HD_REWORK) >= 0) ?? newest)
        : newest;
      out.set(
        gameVersion,
        drawn
          ? { src: drawn.url, latest: false }
          : fallback
            ? { src: fallback.url, latest: false, nearest: fallback.version }
            : { src: null, latest: true },
      );
      continue;
    }
    const redraw = changes.find(
      (c) => c.images && mapChangeArea(c.field) === MAP_AREA_MAP,
    );
    out.set(gameVersion, { src: redraw?.images?.after.src ?? era, latest: false });
    if (redraw?.images) era = redraw.images.before.src;
  }
  return out;
}
