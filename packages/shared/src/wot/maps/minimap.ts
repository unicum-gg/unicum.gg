import { ArchivedMinimapBranch, iconUrl } from "@unicum.gg/wargaming";

// Our own mirror of the game's top-down minimaps, extracted from the client at
// full 2048² (see the `unicum-gg/wot.maps` repo). Keyed by the exact arena id,
// so no filename healing is needed — every catalogue map has a file.
export const WOT_MAPS_REPO = "unicum-gg/wot.maps";
export const WOT_MAPS_BRANCH = "WG";

// The Common Test branch of the same mirror. A map reaches the test client
// before the live one, and Wargaming sometimes ships an arena's definition to
// the live client with the space itself still missing (the 2.4.0 Onslaught
// arenas have an `arena_defs/<id>.xml` but no `<id>.pkg` in the live manifest,
// so there is no `mmap.dds` to extract and the live branch has no image at all).
// The catalogue still lists those maps, so their minimap is read from the test
// branch instead of falling through to a placeholder.
export const WOT_MAPS_BRANCH_CT = "WG_CT";

// The retired maps' branch of the same mirror, cut from the archived clients:
// the live branches only hold what today's client ships.
export const WOT_MAPS_BRANCH_ARCHIVE = "ARCHIVE";

/** HD (2048²) top-down minimap on the wot.maps mirror, keyed by arena id. Not
 * every arena has one; the client falls back to a placeholder on a 404. */
export function minimapUrl(arenaId: string): string {
  return `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH}/maps/${arenaId}.webp`;
}

/**
 * A retired map's minimap: the archive branch for the ones cut from an archived
 * client, the live one for a map pulled since that mirror began (it keeps what
 * it published). With no image anywhere, the live URL, which 404s onto the
 * component's placeholder like any other missing minimap.
 */
export function retiredMinimapUrl(arenaId: string, branch: ArchivedMinimapBranch | null): string {
  return branch === ArchivedMinimapBranch.Archive
    ? `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH_ARCHIVE}/maps/${arenaId}.webp`
    : minimapUrl(arenaId);
}

/**
 * How many branches the history's images are spread over. jsDelivr refuses to
 * serve anything from a branch past 50 MB, and the history alone is twice that
 * (a minimap per redraw since 0.6.2, plus every rework's overlays), so each map
 * lives on `ARCHIVE_HISTORY_<n>`, picked from its arena id. `wot.build`'s
 * `publish-archive` spreads them with the same function: change one, change
 * both, and republish.
 */
export const ARCHIVE_HISTORY_SHARDS = 8;

/** Which `ARCHIVE_HISTORY_<n>` branch holds a map's history images. */
export function archiveHistoryShard(arenaId: string): number {
  let sum = 0;
  for (let i = 0; i < arenaId.length; i++) sum += arenaId.charCodeAt(i);
  return sum % ARCHIVE_HISTORY_SHARDS;
}

/** An image the archive keeps for the map history (a minimap as it was at one
 * version, a rework's overlay), from the path the history records
 * (`history/<arena>/<file>`). */
export function archivedMinimapUrl(path: string): string {
  const arenaId = /^history\/([^/]+)\//.exec(path)?.[1];
  const branch =
    arenaId === undefined
      ? WOT_MAPS_BRANCH_ARCHIVE
      : `${WOT_MAPS_BRANCH_ARCHIVE}_HISTORY_${archiveHistoryShard(arenaId)}`;
  return `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${branch}/${path}`;
}

/** The same mirror image on the Common Test branch, or null when the URL is not
 * a live wot.maps one (an already-test URL, or the wot.assets low-res icon).
 * Derived from the URL rather than from a list of test-only arenas, so a map
 * moves from the test branch to the live one the day the client ships its
 * package, with no code change. */
export function ctMinimapUrl(url: string): string | null {
  // The CDN spells a ref with `@`, not as a path segment. Matched on the shape
  // the builders above produce rather than on a remembered one: read against
  // the old shape this simply found nothing, and every test-only map lost its
  // minimap without a word.
  const live = `/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH}/`;
  if (!url.includes(live)) return null;
  return url.replace(live, `/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH_CT}/`);
}

/** The Onslaught (comp7) minimap variant, a reduced play area shipped by most
 * Onslaught maps (`<id>_comp7.webp` on the mirror). */
export function onslaughtMinimapUrl(arenaId: string): string {
  return `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH}/maps/${arenaId}_comp7.webp`;
}

/** One of a map's alternate minimap layers on the mirror, keyed by the layer
 * file's own basename (`mmap_crash01_airship_zone`): the mirror publishes each
 * `spaces/<id>/mmap<variant>.dds` as `<id><variant>.webp`, so the Onslaught
 * variant above and a random event's art follow the same rule. Transparent
 * everywhere but the patch they redraw, so they compose over the standard
 * minimap. */
export function minimapLayerUrl(arenaId: string, basename: string): string {
  const variant = basename.replace(/^mmap/, "");
  return `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH}/maps/${arenaId}${variant}.webp`;
}

// Low-res fallback minimap: the client's own baked GUI icon on the wot.assets
// mirror. Used for legacy event/arcade maps that have no HD `mmap.dds` in their
// package (so the HD wot.maps extraction skips them) but still ship a GUI icon.
// Built through `iconUrl` rather than spelling the mirror out again: that repo
// and branch have one definition, in `wargaming`'s `assets-mirror.ts`.

/** Low-res client minimap icon (`gui/maps/icons/map/<id>.png`). */
export function lowResMinimapUrl(arenaId: string): string {
  return iconUrl(`map/${arenaId}.png`);
}

/** The game's own minimap entry markers, extracted from the client battle atlas
 * (`gui/flash/atlases/battleAtlas.dds`) into the wot.maps mirror. Region-agnostic
 * GUI, so a single set lives on the primary branch. Names: `base_ally`,
 * `base_enemy`, `control_point`, `spawn_{ally,enemy}_{1..4}`. */
export function markerUrl(name: string): string {
  return `https://cdn.jsdelivr.net/gh/${WOT_MAPS_REPO}@${WOT_MAPS_BRANCH}/markers/${name}.png`;
}
