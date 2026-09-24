import { unstable_cache } from "next/cache";
import APP from "@/constants/app";

/**
 * Which version of the mod each place is handing out.
 *
 * The two are rarely the same, and that gap is the whole reason the mod page
 * offers two ways to get it: a release lands on GitHub the moment it is cut,
 * and reaches wgmods only once Wargaming has reviewed it, which took six days
 * for 0.1.1. Naming both versions is what makes that legible to a player, who
 * otherwise sees two download paths and no way to tell them apart.
 *
 * Neither call is allowed to break the page. A version is a nice thing to
 * print, never the reason someone came, so every failure resolves to null and
 * the page simply says less.
 */
export type ModVersions = {
  /** The newest release, e.g. "0.2.0", or null when GitHub could not be read. */
  latest: string | null;
  /** What the hub currently serves, or null when its API could not be read. */
  hub: string | null;
};

const GITHUB_RELEASE = "https://api.github.com/repos/unicum-gg/unicum.gg-mod/releases/latest";

/**
 * The hub's own endpoint, the one its mod page calls to draw itself.
 *
 * Undocumented and not offered for third-party use, so it is treated as it
 * deserves: read defensively, cached hard, and never load-bearing. It needs
 * `X-Requested-With`, without which it answers 404 rather than saying what it
 * wants, which is how it was first mistaken for not existing at all.
 */
const WGMODS_API = "https://wgmods.net/api/mods/7928/";

async function readLatest(): Promise<string | null> {
  try {
    const response = await fetch(GITHUB_RELEASE, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { tag_name?: unknown };
    // Releases are tagged `v0.2.0`; the page prints the version, not the tag.
    return typeof body.tag_name === "string" ? body.tag_name.replace(/^v/, "") : null;
  } catch {
    return null;
  }
}

async function readHub(): Promise<string | null> {
  try {
    const response = await fetch(WGMODS_API, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { versions?: unknown };
    // Only published versions are listed here; one in review is not, which is
    // exactly the state this is meant to show.
    const versions = Array.isArray(body.versions) ? body.versions : [];
    const newest = versions[0] as { version?: unknown } | undefined;
    return typeof newest?.version === "string" ? newest.version : null;
  } catch {
    return null;
  }
}

async function readVersions(): Promise<ModVersions> {
  const [latest, hub] = await Promise.all([readLatest(), readHub()]);
  return { latest, hub };
}

/**
 * Cached for an hour, because neither number moves faster than a release and
 * one of the two endpoints is somebody else's. A page view must not turn into
 * a call to GitHub and to the hub.
 */
export const getModVersions = unstable_cache(readVersions, ["mod-versions"], {
  revalidate: 3600,
  tags: ["mod-versions"],
});

/**
 * Where a download button points, given the version it just read.
 *
 * Straight at the versioned asset, so what lands in the player's downloads is
 * `unicum.gg_0.2.0.zip` and says which build it is. The alternative was a
 * second copy published under a fixed name, which `releases/latest/download`
 * could resolve without knowing the version; it would have handed everyone a
 * `unicum.gg.zip` that names nothing, and cost a duplicate of the archive on
 * every release. Reading the version first costs one cached call and keeps the
 * file honest.
 *
 * Without a version there is nothing to point at, so the link falls back to
 * the releases page: one click more, and still the right build.
 */
export function modArchiveUrl(version: string | null): string {
  const releases = `${APP.EXTERNAL.MOD_SOURCE}/releases`;
  if (!version) return `${releases}/latest`;
  return `${releases}/download/v${version}/unicum.gg_${version}.zip`;
}
