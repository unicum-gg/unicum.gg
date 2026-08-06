import { APP_IDENTITY, botHeaders } from "@unicum.gg/shared";

/**
 * The commits a changelog is written from, read off GitHub rather than a local
 * `git log`: the worker's container ships the built tree, not the repository,
 * and the API hands us the commit URLs for free. The repo is public, so no
 * token is involved (60 requests/hour per IP, against one call a day).
 */

const API = "https://api.github.com";

export type Commit = {
  sha: string;
  /** Subject line only. Bodies are noise for a changelog. */
  subject: string;
  url: string;
};

type ApiCommit = {
  sha: string;
  html_url: string;
  commit: { message: string };
};

/** Merge commits describe the merge, not the change, and their subject would
 * only mislead the writer. */
function isMerge(subject: string): boolean {
  return subject.startsWith("Merge ");
}

function toCommit(raw: ApiCommit): Commit {
  return {
    sha: raw.sha,
    subject: raw.commit.message.split("\n")[0].trim(),
    url: raw.html_url,
  };
}

async function githubFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { ...botHeaders(), accept: "application/vnd.github+json" },
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** Everything that landed after `sha`, oldest first. Null when GitHub doesn't
 * know that commit any more (a force-push, a rewritten history), which the
 * caller answers by falling back to a time window. */
async function commitsAfter(sha: string): Promise<Commit[] | null> {
  const compare = await githubFetch<{ commits: ApiCommit[] }>(
    `/repos/${APP_IDENTITY.REPO}/compare/${sha}...HEAD`,
  );
  if (!compare) return null;
  return compare.commits.map(toCommit).filter((c) => !isMerge(c.subject));
}

/** Everything from the last `hours`, oldest first. */
async function commitsWithin(hours: number): Promise<Commit[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const commits = await githubFetch<ApiCommit[]>(
    `/repos/${APP_IDENTITY.REPO}/commits?since=${since}&per_page=100`,
  );
  if (!commits) return [];
  // The list endpoint answers newest first, the compare endpoint oldest first.
  // Normalize on oldest first so a changelog reads in the order things shipped.
  return commits.reverse().map(toCommit).filter((c) => !isMerge(c.subject));
}

/**
 * The commits to write about: everything since the last published one, or the
 * last `fallbackHours` when there is no last one (first run, or a history the
 * API no longer recognises).
 */
export async function listNewCommits(
  sinceSha: string | null,
  fallbackHours: number,
): Promise<Commit[]> {
  if (sinceSha) {
    const commits = await commitsAfter(sinceSha);
    if (commits) return commits;
    console.warn(
      `[changelog] ${sinceSha.slice(0, 7)} is unknown to GitHub, falling back to the last ${fallbackHours}h`,
    );
  }
  return commitsWithin(fallbackHours);
}
