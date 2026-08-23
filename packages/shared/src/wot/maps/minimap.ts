import { iconUrl } from "@unicum.gg/wargaming";

// Our own mirror of the game's top-down minimaps, extracted from the client at
// full 2048² (see the `unicum-gg/wot.maps` repo). Keyed by the exact arena id,
// so no filename healing is needed — every catalogue map has a file.
export const WOT_MAPS_REPO = "unicum-gg/wot.maps";
export const WOT_MAPS_BRANCH = "WG";

/** HD (2048²) top-down minimap on the wot.maps mirror, keyed by arena id. Not
 * every arena has one; the client falls back to a placeholder on a 404. */
export function minimapUrl(arenaId: string): string {
  return `https://raw.githubusercontent.com/${WOT_MAPS_REPO}/${WOT_MAPS_BRANCH}/maps/${arenaId}.webp`;
}

/** The Onslaught (comp7) minimap variant, a reduced play area shipped by most
 * Onslaught maps (`<id>_comp7.webp` on the mirror). */
export function onslaughtMinimapUrl(arenaId: string): string {
  return `https://raw.githubusercontent.com/${WOT_MAPS_REPO}/${WOT_MAPS_BRANCH}/maps/${arenaId}_comp7.webp`;
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
  return `https://raw.githubusercontent.com/${WOT_MAPS_REPO}/${WOT_MAPS_BRANCH}/markers/${name}.png`;
}
