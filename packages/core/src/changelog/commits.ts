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

/** A read that came back with no commits, told apart by what the nothing means.
 * The difference decides whether a batch can be consumed: one is an answer, the
 * other is the absence of one. */
enum ReadFailure {
  /** GitHub does not know the sha we published from any more, which is what a
   * force-push or a rewritten history looks like from here. The caller falls
   * back to a time window. */
  UnknownSha = "unknown-sha",
  /** GitHub did not answer: a 502, a 403 off the unauthenticated budget, a
   * dropped connection. The caller retries instead of reading the silence as a
   * quiet week. */
  Unreadable = "unreadable",
}

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

/** The body, plus the status that stopped us reading it (0 for a request that
 * never got an answer at all). The status is the whole point: "this sha is gone"
 * and "GitHub is having a minute" arrive as the same missing body, and they must
 * not share a branch. */
async function githubFetch<T>(
  path: string,
): Promise<{ data: T | null; status: number }> {
  const res = await fetch(`${API}${path}`, {
    headers: { ...botHeaders(), accept: "application/vnd.github+json" },
  }).catch(() => null);
  if (!res) return { data: null, status: 0 };
  if (!res.ok) return { data: null, status: res.status };
  return {
    data: (await res.json().catch(() => null)) as T | null,
    status: res.status,
  };
}

/** Everything that landed after `sha`, oldest first.
 *
 * `total_commits` is the real count and the `commits` array is capped, so the
 * pages are followed until it is covered. A page that fails mid-walk returns
 * what came before it rather than nothing: this endpoint answers oldest first,
 * so a short read is a prefix, and the caller stamps the last commit it wrote
 * about, which leaves the tail for the next run instead of skipping it. */
async function commitsAfter(sha: string): Promise<Commit[] | ReadFailure> {
  const raw: ApiCommit[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data: compare, status } = await githubFetch<{
      commits: ApiCommit[];
      total_commits: number;
    }>(
      `/repos/${APP_IDENTITY.REPO}/compare/${sha}...HEAD?per_page=${PER_PAGE}&page=${page}`,
    );
    if (!compare) {
      if (page === 1) {
        // A 404 is the only answer that means the sha is gone (422 covers a
        // range GitHub refuses to compare). Everything else is GitHub not
        // answering, and falling back to the time window on those is how a
        // transient 502, or a 403 off the 60 requests an hour this gets
        // unauthenticated, republishes a week the channel has already read,
        // `@here` included.
        return status === 404 || status === 422
          ? ReadFailure.UnknownSha
          : ReadFailure.Unreadable;
      }
      console.warn(
        `[changelog] compare page ${page} failed (${status}), writing the ${raw.length} commits read so far`,
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
 * Pages until a short one, and answers null both if a page fails and if the
 * window turns out to be wider than `MAX_PAGES` can read: this endpoint answers
 * newest first, so a partial read is the newest commits, and writing about those
 * would stamp HEAD over a window whose older half was never covered.
 *
 * Null rather than an empty list, because the two now mean different things to
 * the caller: a window that really landed nothing is a completed run and gets
 * stamped as one, which is what keeps the catch-up from re-reading it every
 * hour. A read that failed must not be able to consume a week that way. */
async function commitsWithin(hours: number): Promise<Commit[] | null> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const raw: ApiCommit[] = [];
  let covered = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data: commits, status } = await githubFetch<ApiCommit[]>(
      `/repos/${APP_IDENTITY.REPO}/commits?since=${since}&per_page=${PER_PAGE}&page=${page}`,
    );
    if (!commits) {
      console.warn(
        `[changelog] commits page ${page} failed (${status}), skipping this run`,
      );
      return null;
    }
    raw.push(...commits);
    if (commits.length < PER_PAGE) {
      covered = true;
      break;
    }
  }
  // Ten full pages means the window holds more than this can read, so what we
  // hold is its newest thousand: writing those up would stamp HEAD over an
  // older half nobody covered, and no later run could go back for it. Same
  // reason a failed page answers null, and loud because this one is a size
  // rather than an outage.
  if (!covered) {
    console.error(
      `[changelog] the last ${hours}h hold more than ${MAX_PAGES * PER_PAGE} commits, skipping this run`,
    );
    return null;
  }
  // The list endpoint answers newest first, the compare endpoint oldest first.
  // Normalize on oldest first so a changelog reads in the order things shipped.
  return raw.reverse().map(toCommit).filter((c) => !isMerge(c.subject));
}

/**
 * The commits to write about: everything since the last published one, or the
 * last `fallbackHours` when there is no last one (first run, or a history the
 * API no longer recognises).
 *
 * An empty list is an answer ("nothing landed"), null is the absence of one
 * ("GitHub did not say"), and the caller has to keep them apart: it consumes
 * the first and retries the second.
 */
export async function listNewCommits(
  sinceSha: string | null,
  fallbackHours: number,
): Promise<Commit[] | null> {
  if (sinceSha) {
    const commits = await commitsAfter(sinceSha);
    if (Array.isArray(commits)) return commits;
    // The window is a recovery from a history GitHub lost, not a retry: it
    // reaches back further than the batch, so covering it because GitHub was
    // briefly unavailable posts entries the channel has already read.
    if (commits === ReadFailure.Unreadable) return null;
    console.warn(
      `[changelog] ${sinceSha.slice(0, 7)} is unknown to GitHub, falling back to the last ${fallbackHours}h`,
    );
  }
  return commitsWithin(fallbackHours);
}
