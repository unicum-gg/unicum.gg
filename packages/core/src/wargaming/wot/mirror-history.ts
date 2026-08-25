import {
  BRANCH_BY_REGION,
  REPO,
  Region,
  type Transport,
  WotSrcBranch,
} from "@unicum.gg/wargaming";

/**
 * Reading the wot-src mirror as it was at any point in its history.
 *
 * Wargaming publishes no archive of past client versions, but our mirror is a
 * git repo fast-forwarded over time, so every past version's client scripts
 * still live at a commit. Pointing a source parser at a commit instead of a
 * branch replays that version's derivation unchanged, which is what both the
 * tank spec history and the map history backfill from.
 */

const GITHUB_API = "https://api.github.com";

/** A game version and the mirror commit that best represents it (its latest
 * build, i.e. the final state of that version). */
export type VersionCommit = { gameVersion: string; sha: string; date: string };

class NotFoundError extends Error {
  constructor(url: string) {
    super(`wot-src 404 ${url}`);
    this.name = "NotFoundError";
  }
}

/**
 * Fetch a raw file with a per-request timeout and retries. A backfill derives
 * hundreds of files per version, and a single stalled socket (after a network
 * blip or a laptop wake) would otherwise hang a whole version's `Promise.all`
 * forever. A 404 is a real "file absent at this commit", so it fails fast.
 */
async function fetchRaw(url: string, attempts = 4): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (res.status === 404) throw new NotFoundError(url);
      if (!res.ok) throw new Error(`wot-src ${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`wot-src fetch failed ${url}`);
}

/**
 * Localization files, which are read from the branch and never from the commit.
 *
 * Two reasons, and either alone would be enough. The mirror's older commits come
 * from a Russian client (1.13.0's `arenas.po` names Karelia `Карелия`), so a
 * backfill keyed on the commit would record half its history under names the
 * site never shows, and a map's name is what identifies it across versions: the
 * forward pipeline, reading today's English names, would then see every map as a
 * different map and re-baseline the lot. And the SDK memoizes a parsed `.po` per
 * branch and file, with no room for a ref, so within one run every version would
 * silently share whichever one was fetched first anyway.
 *
 * What we want the history of is the geometry, not the translations.
 */
const LOCALIZATION_PATH = "/text/lc_messages/";

/**
 * Rewrite the branch segment of a mirror raw URL to a commit ref.
 *
 * The repository name is taken from the SDK's own `REPO` rather than spelled out
 * here: the mirror has already been renamed once (`wot-src` -> `wot.src`), and a
 * hardcoded copy silently stopped matching, which turns a backfill into forty
 * derivations of the same current branch instead of forty versions.
 */
function rewriteRef(url: URL, ref: string): string {
  if (url.hostname !== "raw.githubusercontent.com") return url.toString();
  if (url.pathname.includes(LOCALIZATION_PATH)) return url.toString();
  const parts = url.pathname.split("/"); // ["", "<owner>", "<repo>", "<ref>", ...]
  if (`${parts[1]}/${parts[2]}` !== REPO) return url.toString();
  parts[3] = ref;
  return `${url.origin}${parts.join("/")}`;
}

/**
 * A transport that serves a wot-src parser the files as they were at a given
 * commit. The source resources only ever call `getText`, so this thin stand-in
 * is enough to replay any of them at any point in history. Fetches straight from
 * the raw CDN (public, no auth, no WG rate limit) with a per-instance cache so a
 * version's shared component files are fetched once.
 */
export class MirrorRefTransport {
  readonly #cache = new Map<string, string>();
  constructor(private readonly ref: string) {}

  async getText(url: URL): Promise<string> {
    const target = rewriteRef(url, this.ref);
    const cached = this.#cache.get(target);
    if (cached !== undefined) return cached;
    const text = await fetchRaw(target);
    this.#cache.set(target, text);
    return text;
  }
}

/** The mirror at one commit, typed as the transport the source resources take. */
export function transportAt(sha: string): Transport {
  return new MirrorRefTransport(sha) as unknown as Transport;
}

/**
 * Enumerate the mirror's game versions, newest build per version, oldest first.
 * The game version is read from the commit subject (`v.2.3.1.1 #910` -> `2.3.1`),
 * which matches WG's `game_version` (3-part) and the client `.version_name`, so
 * backfilled versions line up with the forward pipeline's. Several commits share
 * a version (hotfix builds); we keep the latest-dated one as that version's final
 * state.
 */
export async function listVersionCommits(
  region: Region = Region.EU,
  branchOverride?: WotSrcBranch,
): Promise<VersionCommit[]> {
  const branch = branchOverride ?? BRANCH_BY_REGION[region];
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "unicum.gg-backfill",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const MAX_PAGES = 30;
  const best = new Map<string, VersionCommit>();
  let lastPageFull = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${GITHUB_API}/repos/${REPO}/commits?sha=${branch}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`github commits ${res.status}: ${await res.text()}`);
    const commits = (await res.json()) as {
      sha: string;
      commit: {
        message: string;
        committer: { date: string };
        author: { date: string };
      };
    }[];
    if (commits.length === 0) break;
    for (const c of commits) {
      const m = /v\.(\d+\.\d+\.\d+)\.\d+/.exec(c.commit.message);
      if (!m) continue;
      const gameVersion = m[1];
      const date = c.commit.committer?.date ?? c.commit.author.date;
      const existing = best.get(gameVersion);
      // Keep the newest-dated commit for each version (its final hotfix build).
      if (!existing || date > existing.date) {
        best.set(gameVersion, { gameVersion, sha: c.sha, date });
      }
    }
    lastPageFull = commits.length === 100;
    if (!lastPageFull) break;
  }
  // If we stopped because we hit the cap (not because history ran out), the
  // oldest versions were dropped and the tracking start would shift, so warn
  // rather than silently truncate.
  if (lastPageFull) {
    console.warn(
      `[mirror-history] hit the ${MAX_PAGES}-page commit cap; older versions may be missing`,
    );
  }

  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}
