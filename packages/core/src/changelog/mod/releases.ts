import { APP_IDENTITY, botHeaders } from "@unicum.gg/shared";

/**
 * The mod's published releases, read off GitHub.
 *
 * This is where the mod's changelog differs from the site's in the one way that
 * matters: the site's is written from raw commits by a model, because nothing
 * upstream of it is addressed to a player. The mod's is already written. Its
 * `CHANGELOG.md` holds a hand-written section per version, and `release.yml`
 * lifts that section into the release notes, so the text in a release body is
 * the author's own words for players. Handing it to a model would only rewrite
 * a decision that has already been made, in a worse voice and at a cost.
 *
 * The repo is public, so no token (60 requests/hour per IP, against four calls
 * an hour from the poll in `./cron`). Unauthenticated reads never include
 * drafts, which is the behaviour this wants: `0.4.1` sat as a draft for days
 * while its section was already in the CHANGELOG on `main`, and a draft is
 * precisely a version nobody can install yet.
 */

const API = "https://api.github.com";

/**
 * How many releases are read.
 *
 * Generous on purpose. The marker in `../state` is a tag, so it has to be
 * FOUND in this list for the new ones to be the releases after it, and a tag
 * that has fallen off the end is indistinguishable from one that was deleted.
 * At the mod's rate (four releases in a month) thirty pages years of history,
 * so "not in this list" really does mean "gone", which `../mod` answers by
 * reseeding rather than by announcing.
 */
const PER_PAGE = 30;

export type ModRelease = {
  /** The git tag, e.g. `v0.4.1`. What the marker stores. */
  tag: string;
  /** The version the tag names, e.g. `0.4.1`. What a player reads. */
  version: string;
  /** The release notes: the CHANGELOG's own section for this version. */
  notes: string;
  url: string;
  publishedAt: Date;
};

type ApiRelease = {
  tag_name: string;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
};

function toRelease(raw: ApiRelease): ModRelease | null {
  // A published release always carries the date; the field is nullable for the
  // drafts we are not asking for, and a release with no date has no place in an
  // ordering built on it.
  if (!raw.published_at) return null;
  return {
    tag: raw.tag_name,
    version: raw.tag_name.replace(/^v/, ""),
    notes: (raw.body ?? "").trim(),
    url: raw.html_url,
    publishedAt: new Date(raw.published_at),
  };
}

/**
 * Every published release, oldest first.
 *
 * Null means GitHub did not answer, which is not the same as an empty list and
 * must never be read as one: empty consumes nothing but says "there is nothing
 * to announce", while a failed read that looked empty would let the caller
 * reseed its marker off a list it never saw.
 *
 * Oldest first because that is the order the channel should read them in, and
 * the endpoint answers newest first. The same normalisation `../commits` does,
 * for the same reason.
 */
export async function listPublishedReleases(): Promise<ModRelease[] | null> {
  const res = await fetch(
    `${API}/repos/${APP_IDENTITY.MOD_REPO}/releases?per_page=${PER_PAGE}`,
    { headers: { ...botHeaders(), accept: "application/vnd.github+json" } },
  ).catch(() => null);
  if (!res?.ok) {
    console.error(
      `[mod-changelog] GitHub answered ${res?.status ?? "nothing"} for the releases`,
    );
    return null;
  }
  const body = (await res.json().catch(() => null)) as ApiRelease[] | null;
  if (!Array.isArray(body)) return null;

  return body
    .filter((raw) => !raw.draft && !raw.prerelease)
    .map(toRelease)
    .filter((release): release is ModRelease => release !== null)
    .reverse();
}

/**
 * The releases to announce, given how far we got.
 *
 * Null when the marker names a tag this list does not hold, which is the first
 * run (no marker at all) and a deleted tag alike. Both are answered the same
 * way by the caller, and deliberately not by announcing: replaying the archive
 * into a channel is the one failure a reader cannot tell from a real update.
 */
export function releasesAfter(
  releases: ModRelease[],
  tag: string | null,
): ModRelease[] | null {
  if (!tag) return null;
  const at = releases.findIndex((release) => release.tag === tag);
  if (at === -1) return null;
  return releases.slice(at + 1);
}
