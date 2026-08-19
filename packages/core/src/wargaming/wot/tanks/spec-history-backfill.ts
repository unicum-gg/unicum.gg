import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type NewTankChange,
  type NewTankIntroduction,
  type NewTankSpecSnapshot,
  tankChanges,
  tankIntroductions,
  tankSpecSnapshots,
} from "@unicum.gg/shared";
import {
  BRANCH_BY_REGION,
  Region,
  SourceSpecsResource,
  type Transport,
  type WotSrcSpec,
} from "@unicum.gg/wargaming";
import {
  cleanupOscillations,
  diffTrackedSpecs,
  isPlayerTank,
  isReleasedSpec,
  pickTrackedFields,
} from "@unicum.gg/core/wargaming/wot/tanks/spec-history";

/**
 * Historical backfill of the tank changes history from the wot-src mirror's git
 * history. Wargaming publishes no archive of past client versions, but our
 * `unicum-gg/wot-src` mirror is a git repo fast-forwarded over time, so every
 * past game version's client scripts still live at a commit. This re-derives the
 * specs at each version (by pointing the same wot-src parser at the commit's raw
 * files) and diffs them in cascade, producing the real buff/nerf history the
 * forward pipeline can only accrue going forward. Source is 100% the WG client.
 *
 * See `spec-history.ts` (the forward pipeline these tables also feed).
 */

const REPO = "unicum-gg/wot-src";
const GITHUB_API = "https://api.github.com";
const INSERT_CHUNK = 1000;

/** A game version and the mirror commit that best represents it (its latest
 * build, i.e. the final state of that version). */
type VersionCommit = { gameVersion: string; sha: string; date: string };

/**
 * A transport that serves the wot-src parser the files as they were at a given
 * commit, by rewriting the branch segment of every raw.githubusercontent URL to
 * the target ref. The spec derivation only ever calls `getText`, so this thin
 * stand-in (cast to Transport) is enough to replay it at any point in history.
 * Fetches straight from the raw CDN (public, no auth, no WG rate limit) with a
 * per-instance cache so a version's shared component files are fetched once.
 */
class MirrorRefTransport {
  readonly #cache = new Map<string, string>();
  constructor(private readonly ref: string) {}

  async getText(url: URL): Promise<string> {
    const target = rewriteRef(url, this.ref);
    const cached = this.#cache.get(target);
    if (cached !== undefined) return cached;
    const text = await fetchWotSrc(target);
    this.#cache.set(target, text);
    return text;
  }
}

/**
 * Fetch a raw file with a per-request timeout and retries. A backfill derives
 * ~1200 files per version, and a single stalled socket (after a network blip or
 * a laptop wake) would otherwise hang the whole version's `Promise.all` forever.
 * A 404 is a real "file absent at this commit", so it fails fast, not retried.
 */
async function fetchWotSrc(url: string, attempts = 4): Promise<string> {
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

class NotFoundError extends Error {
  constructor(url: string) {
    super(`wot-src 404 ${url}`);
    this.name = "NotFoundError";
  }
}

function rewriteRef(url: URL, ref: string): string {
  if (url.hostname !== "raw.githubusercontent.com") return url.toString();
  const parts = url.pathname.split("/"); // ["", "unicum-gg", "wot-src", "<ref>", ...]
  if (parts[1] === "unicum-gg" && parts[2] === "wot-src") {
    parts[3] = ref;
    return `${url.origin}${parts.join("/")}`;
  }
  return url.toString();
}

/**
 * Enumerate the mirror's game versions, newest build per version, oldest first.
 * The game version is read from the commit subject (`v.2.3.1.1 #910` -> `2.3.1`),
 * which matches WG's `game_version` (3-part) and the client `.version_name`, so
 * backfilled versions line up with the forward pipeline's. Several commits share
 * a version (hotfix builds); we keep the latest-dated one as that version's final
 * state.
 */
async function listVersionCommits(region: Region): Promise<VersionCommit[]> {
  const branch = BRANCH_BY_REGION[region];
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
      commit: { message: string; committer: { date: string }; author: { date: string } };
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
  // oldest versions were dropped and `trackingStart` would shift, so warn rather
  // than silently truncate.
  if (lastPageFull)
    console.warn(
      `[spec-history-backfill] hit the ${MAX_PAGES}-page commit cap; older versions may be missing`,
    );

  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type DerivedSpec = { data: Record<string, number>; tag: string };

/**
 * Re-derive every tank's spec at a mirror commit. Returns the RELEASED, real
 * (non-bot) tanks keyed by id, each with its tracked data and its vehicle tag.
 * Dev stubs and non-player vehicles (bots, event/mode variants) are excluded, and
 * the tag lets the caller detect a reused slot id (a new vehicle at the same id).
 */
async function deriveTrackedAt(
  region: Region,
  sha: string,
): Promise<Map<number, DerivedSpec>> {
  const transport = new MirrorRefTransport(sha) as unknown as Transport;
  const specs: WotSrcSpec[] = await new SourceSpecsResource(
    transport,
    region,
  ).catalog();
  const released = new Map<number, DerivedSpec>();
  for (const spec of specs) {
    if (typeof spec.tankId !== "number") continue;
    const tag = typeof spec.tag === "string" ? spec.tag : null;
    if (!isPlayerTank(tag)) continue; // bots / event / mode variants are not tanks
    const data = pickTrackedFields(spec as unknown as Record<string, unknown>);
    // Skip dev stubs so a tank's history starts at release, not at the garbage
    // stub->real diff (see isReleasedSpec).
    if (!isReleasedSpec(data)) continue;
    released.set(spec.tankId, { data, tag: tag as string });
  }
  return released;
}

async function insertChunked<T>(
  values: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    await write(values.slice(i, i + INSERT_CHUNK));
  }
}

export type BackfillResult = {
  versions: number;
  totalChanges: number;
  perVersion: { gameVersion: string; date: string; tanks: number; changes: number }[];
  skipped: { gameVersion: string; reason: string }[];
};

/**
 * Backfill the whole tank changes history for a region from the mirror git log.
 * Derives specs at each version oldest-first and diffs consecutively, writing a
 * `tank_changes` feed and a final baseline snapshot (the current version), from
 * which the forward pipeline continues seamlessly (same version key, same tracked
 * values). Set `wipe` to clear the two tables first (safe on an initial backfill;
 * both tables are global, so this is region-agnostic — run it once, from EU).
 *
 * Fails soft per version: a version whose derivation yields nothing (an old
 * client format the parser can't read, or a fetch failure) is logged and skipped,
 * never silently dropped, and the cascade continues from the last good baseline.
 */
export async function backfillSpecHistory({
  region = Region.EU,
  wipe = false,
  maxVersions,
  onProgress,
}: {
  region?: Region;
  wipe?: boolean;
  maxVersions?: number;
  onProgress?: (msg: string) => void;
} = {}): Promise<BackfillResult> {
  const log = onProgress ?? (() => {});
  if (wipe) {
    await db.delete(tankChanges);
    await db.delete(tankSpecSnapshots);
    await db.delete(tankIntroductions);
    log("wiped tank_changes + tank_spec_snapshots + tank_introductions");
  }

  let versions = await listVersionCommits(region);
  if (maxVersions && versions.length > maxVersions) {
    versions = versions.slice(-maxVersions); // the most recent N, still chronological
  }
  log(`${versions.length} versions: ${versions.map((v) => v.gameVersion).join(", ")}`);

  const result: BackfillResult = {
    versions: 0,
    totalChanges: 0,
    perVersion: [],
    skipped: [],
  };

  let prev: Map<number, DerivedSpec> | null = null;
  let lastGood: { gameVersion: string; specs: Map<number, DerivedSpec>; date: string } | null = null;
  // First version (chronological) is the tracking start: a tank first seen there
  // existed at/before it, so that event predates our window and stays unknown.
  const trackingStart = versions[0]?.date ?? null;
  // Per tank id, the first version where its CURRENT-run tag appeared. WG reuses a
  // slot id for a new vehicle, so the tag changing resets this to the new tank's
  // first version, crediting the introduction to the current occupant.
  const introOf = new Map<number, { tag: string; version: string; date: string }>();

  for (const { gameVersion, sha, date } of versions) {
    let specs: Map<number, DerivedSpec>;
    try {
      specs = await deriveTrackedAt(region, sha);
    } catch (err) {
      result.skipped.push({ gameVersion, reason: String(err) });
      log(`skip ${gameVersion}: ${String(err)}`);
      continue;
    }
    if (specs.size === 0) {
      result.skipped.push({ gameVersion, reason: "no specs derived (format drift?)" });
      log(`skip ${gameVersion}: no specs derived`);
      continue;
    }

    // Introduction bookkeeping: first sighting of each tag, reset on a slot flip.
    for (const [tankId, { tag }] of specs) {
      const cur = introOf.get(tankId);
      if (!cur || cur.tag !== tag) introOf.set(tankId, { tag, version: gameVersion, date });
    }

    const capturedAt = new Date(date);
    const changes: NewTankChange[] = [];
    if (prev) {
      for (const [tankId, { data, tag }] of specs) {
        const before = prev.get(tankId);
        // Only diff within the same vehicle: a new tank, or a slot reused by a
        // different vehicle (tag change), is not a "change".
        if (!before || before.tag !== tag) continue;
        for (const change of diffTrackedSpecs(before.data, data)) {
          changes.push({ tankId, gameVersion, capturedAt, ...change });
        }
      }
      await insertChunked(changes, (chunk) => db.insert(tankChanges).values(chunk));
    }

    result.versions += 1;
    result.totalChanges += changes.length;
    result.perVersion.push({ gameVersion, date, tanks: specs.size, changes: changes.length });
    log(`${gameVersion} (${date.slice(0, 10)}): ${specs.size} tanks, ${changes.length} changes`);

    prev = specs;
    lastGood = { gameVersion, specs, date };
  }

  // The forward pipeline reads the latest snapshot per tank as its baseline, so
  // persist one snapshot set: the final backfilled version (the current specs).
  if (lastGood) {
    const { gameVersion: lastVersion, specs: lastSpecs } = lastGood;
    const capturedAt = new Date(lastGood.date);
    const snapshots: NewTankSpecSnapshot[] = [...lastSpecs].map(
      ([tankId, { data, tag }]) => ({ tankId, gameVersion: lastVersion, data, tag, capturedAt }),
    );
    await insertChunked(snapshots, (chunk) =>
      db.insert(tankSpecSnapshots).values(chunk).onConflictDoNothing(),
    );
    log(`baseline snapshot: ${snapshots.length} tanks @ ${lastVersion}`);
  }

  // Per-tank introduction: the first version the current vehicle held the slot. An
  // event dated at the tracking start (the first version) existed at/before our
  // window, so it predates it and gets no row.
  const intros: NewTankIntroduction[] = [];
  for (const [tankId, rel] of introOf) {
    if (trackingStart !== null && rel.date <= trackingStart) continue;
    intros.push({ tankId, releasedVersion: rel.version, releasedAt: new Date(rel.date) });
  }
  await insertChunked(intros, (chunk) =>
    db
      .insert(tankIntroductions)
      .values(chunk)
      .onConflictDoUpdate({
        target: tankIntroductions.tankId,
        set: {
          releasedVersion: sql`excluded.released_version`,
          releasedAt: sql`excluded.released_at`,
          updatedAt: sql`now()`,
        },
      }),
  );
  log(`introductions: ${intros.length} tanks`);

  const dropped = await cleanupOscillations();
  if (dropped > 0) {
    result.totalChanges -= dropped;
    log(`dropped ${dropped} oscillation-artifact changes (multi-config tanks)`);
  }

  return result;
}
