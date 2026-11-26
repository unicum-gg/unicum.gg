import { db } from "@unicum.gg/core/db";
import {
  buildMapSnapshotData,
  diffMapSnapshots,
  isSameMap,
  MAP_MINIMAP_FIELD,
  MAP_OBJECTS_FIELD,
  MAP_RELIEF_FIELD,
  MAP_PRESENCE_FIELD,
  MAP_PRESENT,
  MAP_VISUALS_FIELD,
  MAP_VISUAL_SPAN_FIELD,
  mapChanges,
  mapSnapshots,
  type MapSnapshotData,
  type NewMapChange,
} from "@unicum.gg/shared";
import {
  Region,
  SourceArenasResource,
  type ArchivedVisualChange,
  type WotSrcArena,
} from "@unicum.gg/wargaming";
import {
  ARCHIVE_SRC_BRANCH,
  listVersionCommits,
  transportAt,
  type VersionCommit,
} from "@unicum.gg/core/wargaming/wot/mirror-history";
import { wg } from "../../client";
import { resolveArenaNames } from "@unicum.gg/core/wargaming/wot/maps/catalog";

/**
 * Historical backfill of the map change history from the wot-src mirror's git
 * history.
 *
 * Every past client version's `arena_defs` still live at a commit, so the same
 * parser the live catalogue uses can be replayed at any point since the mirror
 * started (~July 2021) and the results diffed in cascade. The years before that
 * are the mirror's `ARCHIVE` branch, one commit per version from 0.6.2 (2010),
 * rebuilt from the full clients the Internet Archive preserves and read here
 * exactly like the live branch. That is the only way to have this history at
 * all: Wargaming publishes no archive of past clients, and the arena
 * definitions are the only public record of where a map's bases and spawns
 * used to be.
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
async function deriveMapsAt(
  region: Region,
  sha: string,
  retiredNames: ReadonlyMap<string, string>,
): Promise<VersionMaps> {
  const arenas: WotSrcArena[] = await new SourceArenasResource(
    transportAt(sha),
    region,
  ).catalog();
  // The strings are read from the branch head (see `mirror-history`), and the
  // client drops a map's entry some time after the map, so a version that
  // predates the head names maps the head no longer does. The archive kept the
  // name each retired map last had.
  for (const arena of arenas) {
    if (arena.name === arena.arenaId) arena.name = retiredNames.get(arena.arenaId) ?? arena.name;
  }
  const unnamed = resolveArenaNames(arenas);
  return new Map(
    arenas
      // Only the maps the client actually defines: an arena known from the
      // localization alone has no geometry to diff, and its comings and goings
      // there track Wargaming's housekeeping rather than the game's map pool.
      .filter((a) => a.hasDefinition)
      // And only the ones the client names, on the same rule as the forward
      // pipeline: a humanized arena id is not an identity, and both halves feed
      // the same per-version snapshot.
      .filter((a) => !unnamed.has(a.arenaId))
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

  // The archive first: the versions before the mirror began, rebuilt from the
  // archived clients. Optional, so a missing branch only costs the older years.
  const archived: VersionCommit[] = await listVersionCommits(region, ARCHIVE_SRC_BRANCH).catch(
    (err) => {
      log(`no archive branch (${String(err)}), starting at the mirror`);
      return [];
    },
  );
  const live = await listVersionCommits(region);
  const liveVersions = new Set(live.map((v) => v.gameVersion));
  let versions = [...archived.filter((v) => !liveVersions.has(v.gameVersion)), ...live];
  const archive = wg.region(region).source.archivedArenas;
  const retiredNames = await archive.names().catch(() => new Map<string, string>());
  // What each update did to a map's look, which no arena definition says: the
  // archive measured it from the update's own patches. Keyed by version here so
  // each lands with the rest of that version's changes.
  const visuals = new Map<string, { arenaId: string; change: ArchivedVisualChange }[]>();
  for (const [arenaId, changes] of Object.entries(await archive.visualHistory())) {
    for (const change of changes) {
      const list = visuals.get(change.version) ?? [];
      list.push({ arenaId, change });
      visuals.set(change.version, list);
    }
  }
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
      maps = await deriveMapsAt(region, sha, retiredNames);
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
      for (const { arenaId, change } of visuals.get(gameVersion) ?? []) {
        // A map this version did not define, or one the history does not
        // follow (no name), has no page to carry the row.
        if (!maps.has(arenaId) || !prev.has(arenaId)) continue;
        const row = (field: string, next: string) =>
          changes.push({ arenaId, gameVersion, capturedAt, field, previous: null, next });
        // An index written before the relief and objects were measured carries
        // neither, which reads as nothing measured rather than as a failure.
        if (change.relief) row(MAP_RELIEF_FIELD, JSON.stringify(change.relief));
        if (change.objects) row(MAP_OBJECTS_FIELD, JSON.stringify(change.objects));
        if (change.aspects?.length) row(MAP_VISUALS_FIELD, JSON.stringify(change.aspects));
        if (change.through) {
          row(MAP_VISUAL_SPAN_FIELD, JSON.stringify({ from: change.from, through: change.through }));
        }
        if (change.minimap) {
          changes.push({
            arenaId,
            gameVersion,
            capturedAt,
            field: MAP_MINIMAP_FIELD,
            previous: change.minimap.before,
            next: change.minimap.after,
          });
        }
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
