import { APP_IDENTITY, botHeaders } from "@unicum.gg/shared";

/**
 * The commits a changelog is written from, read off GitHub rather than a local
 * `git log`: the worker's container ships the built tree, not the repository,
 * and the API hands us the commit URLs for free. The repo is public, so no
 * token is involved (60 requests/hour per IP, against a handful of calls a
 * week).
 *
 * Both endpoints page, and on a weekly digest that stops being theoretical:
 * this repo lands around a hundred commits a week, the compare endpoint answers
 * at most 250 in one go and the list endpoint at most 100. A single-page read
 * would have quietly written the changelog from part of the week.
 */

const API = "https://api.github.com";

/** One page of either endpoint. 100 is the maximum both accept. */
const PER_PAGE = 100;

/** Ten pages is ten weeks of this repo's pace, well past any gap a missed tick
 * can open, and it bounds an unauthenticated hourly budget of 60 requests. */
const MAX_PAGES = 10;

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
 * caller answers by falling back to a time window.
 *
 * `total_commits` is the real count and the `commits` array is capped, so the
 * pages are followed until it is covered. A page that fails mid-walk returns
 * what came before it rather than nothing: this endpoint answers oldest first,
 * so a short read is a prefix, and the caller stamps the last commit it wrote
 * about, which leaves the tail for the next run instead of skipping it. */
async function commitsAfter(sha: string): Promise<Commit[] | null> {
  const raw: ApiCommit[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const compare = await githubFetch<{
      commits: ApiCommit[];
      total_commits: number;
    }>(
      `/repos/${APP_IDENTITY.REPO}/compare/${sha}...HEAD?per_page=${PER_PAGE}&page=${page}`,
    );
    // The first page failing is what "GitHub does not know this sha" looks
    // like, and it is the caller's cue to fall back.
    if (!compare) {
      if (page === 1) return null;
      console.warn(
        `[changelog] compare page ${page} failed, writing the ${raw.length} commits read so far`,
      );
      break;
    }
    raw.push(...compare.commits);
    if (raw.length >= compare.total_commits || compare.commits.length === 0) {
      break;
    }
  }
  return raw.map(toCommit).filter((c) => !isMerge(c.subject));
}

/** Everything from the last `hours`, oldest first.
 *
 * Pages until a short one, and answers nothing at all if a page fails: this
 * endpoint answers newest first, so a partial read is the newest commits, and
 * writing about those would stamp HEAD over a window whose older half was never
 * covered. An empty answer only costs the run. */
async function commitsWithin(hours: number): Promise<Commit[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const raw: ApiCommit[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const commits = await githubFetch<ApiCommit[]>(
      `/repos/${APP_IDENTITY.REPO}/commits?since=${since}&per_page=${PER_PAGE}&page=${page}`,
    );
    if (!commits) {
      console.warn(
        `[changelog] commits page ${page} failed, skipping this run`,
      );
      return [];
    }
    raw.push(...commits);
    if (commits.length < PER_PAGE) break;
  }
  // The list endpoint answers newest first, the compare endpoint oldest first.
  // Normalize on oldest first so a changelog reads in the order things shipped.
  return raw.reverse().map(toCommit).filter((c) => !isMerge(c.subject));
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
