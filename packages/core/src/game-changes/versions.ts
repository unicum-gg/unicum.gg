import { createHash } from "node:crypto";

/**
 * Which recorded game versions are still to be announced, and when a version
 * has stopped arriving.
 *
 * The marker is the last version announced, stored in `changelog_state` beside
 * the site's commit and the mod's tag. A version is only announced once it has
 * SETTLED: the spec and map histories are written by the daily catalogue
 * refresh, and the client data a version is read from arrives in more than one
 * wave (the definitions with the preload, the rest days later), so a version
 * announced on its first rows would go out with part of its changes and never
 * mention the rest.
 */

/** How long a version must go without a new row before it is announced. */
export const SETTLE_MS = 3 * 60 * 60 * 1000;

export type RecordedVersion = {
  version: string;
  /** When its first row landed, which is what orders the versions. */
  firstAt: Date;
  /** When its newest row landed, which is what says it has settled. */
  lastAt: Date;
};

export type VersionPlan =
  /** No marker, or one naming a version we no longer hold: record the newest
   * settled version and announce nothing, so switching the feed on does not
   * replay the archive into a channel as though it had all just shipped. */
  | { seed: RecordedVersion | null }
  | { pending: RecordedVersion[] };

/**
 * The versions after the marker, oldest first, stopping at the first one still
 * receiving rows: announcing the one after it first would put two updates in
 * the channel out of order.
 */
export function planVersions(
  versions: RecordedVersion[],
  marker: string | null,
  now = Date.now(),
): VersionPlan {
  const ordered = [...versions].sort(
    (a, b) => a.firstAt.getTime() - b.firstAt.getTime(),
  );
  const settled = (v: RecordedVersion) => now - v.lastAt.getTime() >= SETTLE_MS;
  const at = marker ? ordered.findIndex((v) => v.version === marker) : -1;
  if (at === -1) {
    return { seed: ordered.filter(settled).at(-1) ?? null };
  }
  const pending: RecordedVersion[] = [];
  for (const v of ordered.slice(at + 1)) {
    if (!settled(v)) break;
    pending.push(v);
  }
  return { pending };
}

/**
 * The marker for a Common Test: the build, and a hash of what it changes.
 *
 * A test is rebalanced under the same build number, so the build alone would
 * announce the first draft and stay silent about the second. The hash is over
 * the rows' content only, never their capture time, since the table is
 * rewritten on every refresh with the same values.
 */
export function testRef(version: string | null, rows: unknown[]): string {
  const hash = createHash("sha1")
    .update(JSON.stringify(rows.map((r) => JSON.stringify(r)).sort()))
    .digest("hex")
    .slice(0, 12);
  return `${version ?? "unshipped"}#${hash}`;
}

/** Whether a stored test marker is an earlier state of the same build, which
 * the card says ("updated") rather than presenting a new test. */
export function sameBuild(stored: string | null, ref: string): boolean {
  if (!stored) return false;
  return stored.split("#")[0] === ref.split("#")[0];
}
