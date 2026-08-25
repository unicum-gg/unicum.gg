import { db } from "@unicum.gg/core/db";
import {
  buildMapSnapshotData,
  diffMapSnapshots,
  isSameMap,
  MAP_PRESENCE_FIELD,
  MAP_PRESENT,
  mapChanges,
  mapSnapshots,
  type MapSnapshotData,
  type NewMapChange,
} from "@unicum.gg/shared";
import { Region, SourceArenasResource, type WotSrcArena } from "@unicum.gg/wargaming";
import {
  listVersionCommits,
  transportAt,
} from "@unicum.gg/core/wargaming/wot/mirror-history";
import { resolveArenaNames } from "@unicum.gg/core/wargaming/wot/maps/catalog";

/**
 * Historical backfill of the map change history from the wot-src mirror's git
 * history.
 *
 * Every past client version's `arena_defs` still live at a commit, so the same
 * parser the live catalogue uses can be replayed at any point since the mirror
 * started (~July 2021) and the results diffed in cascade. That is the only way
 * to have this history at all: Wargaming publishes no archive of past clients,
 * and the arena definitions are the only public record of where a map's bases
 * and spawns used to be.
 *
 * Cheap compared to the tank backfill (a version is ~70 files rather than
 * ~1200), so the whole history is a couple of minutes rather than an hour.
 *
 * See `history.ts`, the forward pipeline that continues from the baseline this
 * leaves behind.
 */

const INSERT_CHUNK = 500;

/** A version's maps, keyed by arena id. */
type VersionMaps = Map<string, MapSnapshotData>;

/** Re-derive every map at a mirror commit, names resolved the way the live
 * catalogue resolves them (a variant borrows its base map's name), since the
 * name is what identifies the map across versions. */
async function deriveMapsAt(region: Region, sha: string): Promise<VersionMaps> {
  const arenas: WotSrcArena[] = await new SourceArenasResource(
    transportAt(sha),
    region,
  ).catalog();
  resolveArenaNames(arenas);
  return new Map(
    arenas
      // Only the maps the client actually defines: an arena known from the
      // localization alone has no geometry to diff, and its comings and goings
      // there track Wargaming's housekeeping rather than the game's map pool.
      .filter((a) => a.hasDefinition)
      .map((a) => [a.arenaId, buildMapSnapshotData(a)]),
  );
}

async function insertChunked<T>(
  values: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    await write(values.slice(i, i + INSERT_CHUNK));
  }
}

export type MapBackfillResult = {
  versions: number;
  totalChanges: number;
  perVersion: {
    gameVersion: string;
    date: string;
    maps: number;
    changes: number;
    added: number;
    removed: number;
  }[];
  skipped: { gameVersion: string; reason: string }[];
};

/**
 * Backfill the whole map history for a region from the mirror git log, oldest
 * version first. Writes the `map_changes` feed plus a snapshot of every map at
 * every version, the most recent of which is the baseline the forward pipeline
 * continues from.
 *
 * `wipe` clears both tables first: safe on an initial backfill, destructive once
 * the forward pipeline has accrued versions the mirror no longer covers. Both
 * tables are global, so this is region-agnostic: run it once, from EU.
 *
 * Fails soft per version: a version that cannot be derived (a client format the
 * parser predates, a fetch that kept failing) is logged and skipped, and the
 * cascade continues from the last good state rather than inventing a rework out
 * of the gap.
 */
export async function backfillMapHistory({
  region = Region.EU,
  wipe = false,
  maxVersions,
  onProgress,
}: {
  region?: Region;
  wipe?: boolean;
  maxVersions?: number;
  onProgress?: (msg: string) => void;
} = {}): Promise<MapBackfillResult> {
  const log = onProgress ?? (() => {});
  if (wipe) {
    await db.delete(mapChanges);
    await db.delete(mapSnapshots);
    log("wiped map_changes + map_snapshots");
  }

  let versions = await listVersionCommits(region);
  if (maxVersions && versions.length > maxVersions) {
    versions = versions.slice(-maxVersions); // the most recent N, still chronological
  }
  log(`${versions.length} versions: ${versions.map((v) => v.gameVersion).join(", ")}`);

  const result: MapBackfillResult = {
    versions: 0,
    totalChanges: 0,
    perVersion: [],
    skipped: [],
  };

  let prev: VersionMaps | null = null;

  for (const { gameVersion, sha, date } of versions) {
    let maps: VersionMaps;
    try {
      maps = await deriveMapsAt(region, sha);
    } catch (err) {
      result.skipped.push({ gameVersion, reason: String(err) });
      log(`skip ${gameVersion}: ${String(err)}`);
      continue;
    }
    if (maps.size === 0) {
      result.skipped.push({ gameVersion, reason: "no maps derived (format drift?)" });
      log(`skip ${gameVersion}: no maps derived`);
      continue;
    }

    const capturedAt = new Date(date);
    const changes: NewMapChange[] = [];
    const presence = (arenaId: string, added: boolean): NewMapChange => ({
      arenaId,
      gameVersion,
      field: MAP_PRESENCE_FIELD,
      previous: added ? null : MAP_PRESENT,
      next: added ? MAP_PRESENT : null,
      capturedAt,
    });

    if (prev) {
      for (const [arenaId, data] of maps) {
        const before = prev.get(arenaId);
        if (!before) {
          changes.push(presence(arenaId, true));
          continue;
        }
        // A different map handed the same arena id is not a rework of the old
        // one: nothing to diff. It is still this map arriving, and recording it
        // is what dates it — otherwise the reader is told it predates our
        // tracking, because the arena id did.
        if (!isSameMap(before, data)) {
          changes.push(presence(arenaId, true));
          continue;
        }
        for (const change of diffMapSnapshots(before, data)) {
          changes.push({ arenaId, gameVersion, capturedAt, ...change });
        }
      }
      for (const arenaId of prev.keys()) {
        if (!maps.has(arenaId)) changes.push(presence(arenaId, false));
      }
      await insertChunked(changes, (chunk) => db.insert(mapChanges).values(chunk));
    }

    // One snapshot per map per version, not just the final state. It is what
    // lets a reader be told what a map looked like at a given update, it keeps
    // the display name of every version (which is how a re-used arena id is told
    // from a rework), and the whole history is only a few thousand rows.
    await insertChunked(
      [...maps].map(([arenaId, data]) => ({
        arenaId,
        gameVersion,
        name: data.name,
        data,
        capturedAt,
      })),
      (chunk) => db.insert(mapSnapshots).values(chunk).onConflictDoNothing(),
    );

    const added = changes.filter((c) => c.field === MAP_PRESENCE_FIELD && c.next).length;
    const removed = changes.filter(
      (c) => c.field === MAP_PRESENCE_FIELD && !c.next,
    ).length;
    result.versions += 1;
    result.totalChanges += changes.length;
    result.perVersion.push({
      gameVersion,
      date,
      maps: maps.size,
      changes: changes.length,
      added,
      removed,
    });
    log(
      `${gameVersion} (${date.slice(0, 10)}): ${maps.size} maps, ${changes.length} changes (+${added}/-${removed})`,
    );

    prev = maps;
  }

  return result;
}
