// The client's event packs, found by listing the mirror rather than kept in a
// list. Shared by the generators that read them (`generate-event-modes`,
// `generate-game-locales`), so a pack one of them sees is a pack the other sees.
//
// A pack is a folder under `res/<pack>/` (Halloween, Last Stand, Black Signal's
// `fort_rush`…) and any pack that ships text ships its catalogues as
// `<pack>.<catalogue>.extend.po` beside the client's own, so listing the text
// folder once names every pack there is. A GitHub API call (unauthenticated, 60
// an hour; `GITHUB_TOKEN` is used when set): the files themselves are raw reads.
// Deep path, not the barrel: the barrel reaches the client, whose `env.ts`
// validates at import.
import { REPO, WotSrcBranch } from "@unicum.gg/wargaming/source/wot/mirror";

export const PACKS_BRANCH = WotSrcBranch.EU;
export const TEXT_DIR = "sources/res/text/lc_messages";

/** A GitHub API answer for the mirror, or a throw naming what failed. */
export async function mirrorApi<T>(path: string): Promise<T> {
  const url = `https://api.github.com/repos/${REPO}/${path}`;
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** The files under `dir` on the branch, recursively when asked. */
export async function mirrorListing(dir: string, recursive = false): Promise<string[]> {
  const tree = await mirrorApi<{
    tree: { path: string; type: string }[];
    truncated: boolean;
  }>(`git/trees/${PACKS_BRANCH}:${dir}${recursive ? "?recursive=1" : ""}`);
  if (tree.truncated) throw new Error(`${dir}: listing truncated`);
  return tree.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
}

/** Every pack that ships a catalogue, sorted. */
export async function eventPacks(): Promise<string[]> {
  const packs = new Set<string>();
  for (const file of await mirrorListing(TEXT_DIR)) {
    const found = /^([a-z0-9_]+)\.[a-z0-9_]+\.extend\.po$/.exec(file);
    if (found) packs.add(found[1]);
  }
  return [...packs].sort();
}
