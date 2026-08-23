// The wot.assets mirror's coordinates and URL builders live in
// `@unicum.gg/wargaming` (`assets-mirror.ts`), next to the wot-src mirror they
// are extracted alongside, because `cdn.ts` in that package needs them too and
// the dependency only runs one way. Re-exported here so every existing
// `@unicum.gg/shared` import keeps resolving.
export {
  ASSETS_BRANCH,
  ASSETS_BRANCH_CT,
  ASSETS_REPO,
  assetsRefFor,
  assetUrl,
  iconUrl,
} from "@unicum.gg/wargaming";

import { iconUrl } from "@unicum.gg/wargaming";

/** The largest in-client vehicle render on the mirror (420x307), keyed by the
 * lowercased vehicle tag (e.g. `F139_Terrifiant` -> `f139_terrifiant`). Used as
 * the tank-hero fallback when WG's portal CDN has no hi-res render: not every
 * tank has one, so callers fall through to a placeholder on a 404. */
export function vehicleRenderUrl(tag: string, ref?: string): string {
  return iconUrl(`vehicle/420x307/${tag.toLowerCase()}.png`, ref);
}
