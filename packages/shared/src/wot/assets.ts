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

/** Where the mirror may hold a vehicle's in-client render, best first.
 *
 * The largest is 420x307, keyed by the lowercased tag (`F139_Terrifiant` ->
 * `f139_terrifiant`). Used as the tank-hero fallback when WG's portal CDN has
 * no hi-res render, so callers try each in turn and fall through to a
 * placeholder when none answers.
 *
 * **An event vehicle's render is often only in the next size down, and named
 * differently.** The modes ship theirs as `<name>.extend.png`, and several (the
 * Halloween Havoc among them) have no 420x307 at all, only a 380x304 keyed by
 * nation and the tag as written (`uk-GB123_GSOR_1006_v7_Halloween_event`). Same
 * three-quarter angle on a canvas of nearly the same shape, so the hero's
 * framing reads it unchanged. */
export function vehicleRenderUrls(tag: string, nation: string, ref?: string): string[] {
  const lower = tag.toLowerCase();
  return [
    iconUrl(`vehicle/420x307/${lower}.png`, ref),
    iconUrl(`vehicle/420x307/${lower}.extend.png`, ref),
    iconUrl(`vehicle/x380x304/${nation}-${tag}.extend.png`, ref),
    iconUrl(`vehicle/x380x304/${nation}-${tag}.png`, ref),
  ];
}
