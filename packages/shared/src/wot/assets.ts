// Our mirror of WG's in-client GUI icons (`unicum-gg/wot.assets`, branch `WG`).
// WG's own icon CDN paths die after each crew/UI rework, so — exactly like the
// wot-src client-script mirror (`source/wot/mirror.ts`) — we serve them from a
// fork we control instead of committing binaries into this repo. A single branch
// (`WG`): these are UI assets, not per-region client builds.
export const ASSETS_REPO = "unicum-gg/wot.assets";
export const ASSETS_BRANCH = "WG";

/** Raw-content URL for `path` on the wot.assets mirror. */
export function assetUrl(path: string): string {
  return `https://raw.githubusercontent.com/${ASSETS_REPO}/${ASSETS_BRANCH}/${path}`;
}

/** Raw-content URL under `gui/maps/icons/<path>`, the icon subtree every one of
 * our references lives in (crew skills, ammo panel, perks, post-progression,
 * equipment overlays). */
export function iconUrl(path: string): string {
  return assetUrl(`gui/maps/icons/${path}`);
}

/** The largest in-client vehicle render on the mirror (420x307), keyed by the
 * lowercased vehicle tag (e.g. `F139_Terrifiant` -> `f139_terrifiant`). Used as
 * the tank-hero fallback when WG's portal CDN has no hi-res render: not every
 * tank has one, so callers fall through to a placeholder on a 404. */
export function vehicleRenderUrl(tag: string): string {
  return iconUrl(`vehicle/420x307/${tag.toLowerCase()}.png`);
}
