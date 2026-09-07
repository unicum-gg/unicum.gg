import { WotSrcBranch } from "./source/wot/mirror";

// Our mirror of WG's in-client GUI icons (`unicum-gg/wot.assets`). WG's own icon
// CDN paths die after each crew/UI rework, so — exactly like the wot-src
// client-script mirror (`source/wot/mirror.ts`, its sibling here) — we serve
// them from a fork we control instead of committing binaries into the app repo.
//
// It lives in this package rather than in `shared` because `cdn.ts` needs it
// too, and the dependency runs shared -> wargaming: a copy on the other side is
// how the branch name ended up written out three times, once per consumer, each
// silently 404ing the day the mirror is renamed. `shared` re-exports all of this
// so the app keeps importing it from where it always has.
export const ASSETS_REPO = "unicum-gg/wot.assets";

/** The live client's branch. A single one: these are UI assets, not per-region
 * client builds. */
export const ASSETS_BRANCH = "WG";

/** The Common Test client's branch of the same mirror. An unreleased vehicle
 * exists nowhere else: WG's public CDN 404s on it, and the live branch will not
 * carry it until it ships. */
export const ASSETS_BRANCH_CT = "WG_CT";

/**
 * The assets branch matching a branch of the client-scripts mirror.
 *
 * The two mirrors are extracted from the same client builds, so an icon follows
 * the scripts that name it: a vehicle read from the test branch has icons only
 * the test branch carries (its skill-tree nodes are keyed by vehicle, e.g.
 * `s41_mechanic_0.png` for the BV-111, and the live branch 404s on them). The
 * test branch is a full extract, so the generic icons are on it too and there is
 * nothing to fall back to the live branch for.
 *
 * Undefined for a live branch, which is `assetUrl`'s default.
 */
export function assetsRefFor(branch?: WotSrcBranch): string | undefined {
  return branch === WotSrcBranch.CT ? ASSETS_BRANCH_CT : undefined;
}

/**
 * URL for `path` on the wot.assets mirror. `ref` (a branch or a commit SHA)
 * defaults to the live branch; pass a commit SHA to pin the asset to a past
 * state (e.g. a season's art as it was while that season was live).
 *
 * **Through a CDN, because GitHub serves raw files with five minutes of
 * cache.** These are icons: three of them are CSS masks on every tank page and
 * so cannot go through the image optimizer, and a well-dressed vehicle lists
 * seven hundred style swatches. Five minutes means a reader downloads the lot
 * again on their second visit to the same page.
 *
 * **A branch is safe to pin here, unlike on the geometry.** This mirror
 * accumulates: WG pulls an event's art when the event ends and the extraction
 * writes over its branch without clearing, so a file that exists never changes
 * and a week of caching cannot go stale. What a new client adds is simply not
 * cached yet.
 */
export function assetUrl(path: string, ref: string = ASSETS_BRANCH): string {
  return `https://cdn.jsdelivr.net/gh/${ASSETS_REPO}@${ref}/${path}`;
}

/** Raw-content URL under `gui/maps/icons/<path>`, the icon subtree every one of
 * our references lives in (crew skills, ammo panel, perks, post-progression,
 * equipment overlays). `ref` pins to a commit (see `assetUrl`). */
export function iconUrl(path: string, ref?: string): string {
  return assetUrl(`gui/maps/icons/${path}`, ref);
}
