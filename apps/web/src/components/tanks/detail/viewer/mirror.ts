import { modelsRoot } from "@unicum.gg/wargaming";

// Where a vehicle's geometry is read from, and which vehicles there are.
//
// Its own file because both answers are the mirror's rather than the viewer's,
// and because the index is fetched once for a whole session: a module holds
// that naturally, a component would have to be told not to ask twice.

// Where the geometry is read from. The mirror in production; a local tree in
// development, since a freshly generated catalogue is eighteen gigabytes and
// takes a while to reach GitHub. Point `NEXT_PUBLIC_MODELS_ROOT` at one with
// `ln -s <out> apps/web/public/models` and `/models`.
export const MIRROR = process.env.NEXT_PUBLIC_MODELS_ROOT || modelsRoot();

/**
 * Which vehicles the mirror carries, and where each one's geometry sits.
 *
 * **The path is looked up, never built.** Neither half of it can be worked out
 * from what the page knows: the nation folder is not the nation the scripts
 * name, `russian` against `ussr`, and the folder is not always the vehicle's own
 * code, since a quarter of the catalogue draws from another vehicle's meshes.
 * `G98_Waffentrager_E100_P` reads `german/G98_Waffentrager_E100`.
 *
 * It doubles as the list of what exists, which is how a vehicle with no model is
 * told apart from a request that failed. Fetched once for the whole session: it
 * is the same file for every tank.
 */
let index: Promise<Record<string, string>> | null = null;
export function carried(): Promise<Record<string, string>> {
  // **A failure is not kept.** Memoised with its fallback, one dropped
  // connection answered every tank the reader opened afterwards with an empty
  // index, so every one of them fell back to the flat render for the rest of
  // the session with nothing on screen saying why. The next tank tries again.
  index ??= fetch(`${MIRROR}/vehicles.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no index"))))
    .catch(() => {
      index = null;
      return {} as Record<string, string>;
    });
  return index;
}
