import {
  MODELS_BRANCH,
  MODELS_REPO,
  modelUrl,
  type WotSrcBranch,
  modelsRefFor,
} from "@unicum.gg/wargaming";
import { cachedInRedis } from "../../../redis";

// Which build of the geometry mirror is current, and what it carries.
//
// **Both answers in one, because the viewer needs them together.** It cannot
// fetch a vehicle without knowing where the mirror keeps it, and it should not
// fetch anything without knowing which commit it is reading: pinned to the
// commit, every file under it is immutable and can be cached for as long as a
// CDN will hold it, and a patch invalidates the lot by changing the address.
//
// Read here rather than in the browser because the commit costs a call to
// GitHub's API, which is rate limited per address: sixty an hour would be gone
// in a minute of traffic. Behind one shared entry it is six an hour.

/** How long a resolved build is held. A patch reaches readers within this. */
const TTL_SECONDS = 10 * 60;

/** The mirror as it stands: the commit, and every vehicle it carries. */
export type MirrorBuild = {
  /**
   * The commit the geometry should be read at, where it could be resolved.
   *
   * Null when GitHub would not say, which is not worth failing over: the caller
   * falls back to the branch, which is the same files with a weaker guarantee
   * about when a patch reaches a reader.
   */
  sha: string | null;
  /** Where each vehicle's folder sits, by the code the client gives it. */
  vehicles: Record<string, string>;
};

/** The commit a branch points at, or null if GitHub will not say right now. */
async function headOf(branch: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${MODELS_REPO}/git/ref/heads/${branch}`,
      { headers: { accept: "application/vnd.github+json" } },
    );
    if (!r.ok) return null;
    const body = (await r.json()) as { object?: { sha?: string } };
    const sha = body.object?.sha;
    return typeof sha === "string" && sha.length >= 7 ? sha : null;
  } catch {
    return null;
  }
}

/**
 * What the viewer needs before it can draw anything.
 *
 * **The index is the list of what exists**, which is how a vehicle the mirror
 * does not carry is told apart from a request that failed. Empty on any
 * failure, so a viewer offered nothing shows the render it already has rather
 * than reaching for files that are not there.
 */
export function getModelsMirror(branch?: WotSrcBranch): Promise<MirrorBuild> {
  const ref = modelsRefFor(branch) ?? MODELS_BRANCH;
  return cachedInRedis(
    `models:mirror:${ref}`,
    // A build that resolved is worth the full window. One that did not is worth
    // a minute: it is a GitHub blip, and holding it would keep every reader on
    // the weaker fallback for ten.
    (build: MirrorBuild) =>
      build.sha && Object.keys(build.vehicles).length > 0 ? TTL_SECONDS : 60,
    async () => {
      const [sha, vehicles] = await Promise.all([
        headOf(ref),
        fetch(modelUrl("vehicles.json", ref))
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
      ]);
      return { sha, vehicles: vehicles as Record<string, string> };
    },
  );
}
