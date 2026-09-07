import { modelsCdn } from "@unicum.gg/wargaming";

// Where a vehicle's geometry is read from, and which vehicles there are.
//
// Its own file because both answers are the mirror's rather than the viewer's,
// and because they are fetched once for a whole session: a module holds that
// naturally, a component would have to be told not to ask twice.

/**
 * A local tree instead of the mirror, for developing against one.
 *
 * A freshly generated catalogue is eighteen gigabytes and takes a while to
 * reach the mirror, so it is read off disk long before it is published. Point
 * this at one with `ln -s <out> apps/web/public/models` and `/models`.
 */
const LOCAL = process.env.NEXT_PUBLIC_MODELS_ROOT;

/** Where the geometry is read from, and what the mirror carries. */
export type Mirror = {
  /**
   * The root every path hangs off.
   *
   * **Pinned to a commit, so a file under it never changes.** The mirror is
   * eleven megabytes for one vehicle across thirty files, and GitHub serves
   * those raw with five minutes of cache: a reader who looked at five tanks and
   * came back to the first downloaded it again. Read through a CDN at a fixed
   * commit it is a week, and a patch reaches them by changing the address
   * rather than by expiring anything.
   */
  root: string;
  /**
   * Which vehicles the mirror carries, and where each one's geometry sits.
   *
   * **The path is looked up, never built.** Neither half of it can be worked out
   * from what the page knows: the nation folder is not the nation the scripts
   * name, `russian` against `ussr`, and the folder is not always the vehicle's
   * own code, since a quarter of the catalogue draws from another vehicle's
   * meshes. `G98_Waffentrager_E100_P` reads `german/G98_Waffentrager_E100`.
   *
   * It doubles as the list of what exists, which is how a vehicle with no model
   * is told apart from a request that failed.
   */
  vehicles: Record<string, string>;
};

let resolved: Promise<Mirror> | null = null;

/**
 * The mirror, resolved once for the whole session.
 *
 * **A failure is not kept.** Memoised with its fallback, one dropped connection
 * answered every tank the reader opened afterwards with an empty index, so
 * every one of them fell back to the flat render for the rest of the session
 * with nothing on screen saying why. The next tank tries again.
 */
export function mirror(): Promise<Mirror> {
  resolved ??= read().catch(() => {
    resolved = null;
    // The address without the index: a vehicle cannot be found without it, so
    // this is the flat render, but it is the same shape rather than a throw.
    return { root: LOCAL ?? modelsCdn(), vehicles: {} };
  });
  return resolved;
}

async function read(): Promise<Mirror> {
  // A local tree answers for itself: there is no commit to pin and no endpoint
  // that knows where it is.
  if (LOCAL) {
    const r = await fetch(`${LOCAL}/vehicles.json`);
    if (!r.ok) throw new Error("no index");
    return { root: LOCAL, vehicles: await r.json() };
  }
  const r = await fetch("/api/models");
  if (!r.ok) throw new Error("no mirror");
  const { root, vehicles } = (await r.json()) as Mirror;
  return { root, vehicles };
}
