import { desc, sql } from "drizzle-orm";
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
  type NewMapSnapshotRow,
} from "@unicum.gg/shared";
import type { WotSrcArena } from "@unicum.gg/wargaming";

const INSERT_CHUNK = 500;

/** A map's last recorded state, whatever version it was recorded at. */
type LatestSnapshot = {
  gameVersion: string;
  name: string;
  data: MapSnapshotData;
};

/**
 * The most recent snapshot of every map, keyed by arena id. One row per map:
 * the whole diff is against a map's last known state, not against a particular
 * version, so a map that was absent for a season still diffs against what it
 * looked like when it left.
 */
async function loadLatestSnapshots(): Promise<Map<string, LatestSnapshot>> {
  const rows = await db
    .selectDistinctOn([mapSnapshots.arenaId], {
      arenaId: mapSnapshots.arenaId,
      gameVersion: mapSnapshots.gameVersion,
      name: mapSnapshots.name,
      data: mapSnapshots.data,
    })
    .from(mapSnapshots)
    .orderBy(mapSnapshots.arenaId, desc(mapSnapshots.capturedAt));
  return new Map(rows.map((r) => [r.arenaId, r]));
}

/**
 * The maps currently recorded as gone from the client (their last presence
 * change was a removal).
 *
 * Without this, every version after a map leaves would record that it left
 * again: a map's absence is a state, while the feed stores events.
 */
async function loadAbsentMaps(): Promise<Set<string>> {
  const rows = await db
    .selectDistinctOn([mapChanges.arenaId], {
      arenaId: mapChanges.arenaId,
      next: mapChanges.next,
    })
    .from(mapChanges)
    .where(sql`${mapChanges.field} = ${MAP_PRESENCE_FIELD}`)
    .orderBy(mapChanges.arenaId, desc(mapChanges.capturedAt));
  return new Set(rows.filter((r) => r.next === null).map((r) => r.arenaId));
}

async function insertChunked<T>(
  values: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    await write(values.slice(i, i + INSERT_CHUNK));
  }
}

export type MapHistoryResult = {
  version: string;
  snapshots: number;
  changes: number;
};

/**
 * Record what changed about the game's maps at `gameVersion`, against each map's
 * last known state.
 *
 * The forward half of the map history: called after a catalogue refresh, it
 * freezes a snapshot per map and writes the differences a player could notice.
 * The backfill (`history-backfill.ts`) fills the same two tables from the
 * mirror's git history and hands this the final baseline, so the two meet
 * without a seam.
 *
 * The first run is a seed: with no baselines to compare against, every map would
 * otherwise be reported as newly added on the day we started looking.
 *
 * `arenas` must carry resolved display names (`resolveArenaNames`), since the
 * name is what tells a reworked map from a different map handed the same arena
 * id.
 */
export async function recordMapChanges(
  arenas: WotSrcArena[],
  gameVersion: string,
  capturedAt: Date = new Date(),
): Promise<MapHistoryResult> {
  const [latest, absent] = await Promise.all([
    loadLatestSnapshots(),
    loadAbsentMaps(),
  ]);
  const seeding = latest.size === 0;
  const snapshots: NewMapSnapshotRow[] = [];
  const changes: NewMapChange[] = [];
  const seen = new Set<string>();

  const presence = (arenaId: string, added: boolean): NewMapChange => ({
    arenaId,
    gameVersion,
    field: MAP_PRESENCE_FIELD,
    previous: added ? null : MAP_PRESENT,
    next: added ? MAP_PRESENT : null,
    capturedAt,
  });

  for (const arena of arenas) {
    // Maps known only from the localization carry nothing to compare, and their
    // presence there is not the map's: the client keeps naming maps years after
    // pulling them (Kharkov's entry outlived the map itself), and drops them back
    // in for an event. Tracking them would fill the feed with additions and
    // removals of maps nobody gained or lost.
    if (!arena.hasDefinition) continue;
    const arenaId = arena.arenaId;
    seen.add(arenaId);
    const data = buildMapSnapshotData(arena);
    const prev = latest.get(arenaId);
    const baseline = (): void => {
      snapshots.push({
        arenaId,
        gameVersion,
        name: data.name,
        data,
        capturedAt,
      });
    };

    if (!prev) {
      if (!seeding) changes.push(presence(arenaId, true));
      baseline();
      continue;
    }
    // Already baselined at this version: the per-version snapshot is immutable,
    // so a re-run within a patch (a redeploy, a second cron tick) is inert.
    if (prev.gameVersion === gameVersion) continue;

    const cameBack = absent.has(arenaId);
    if (cameBack) changes.push(presence(arenaId, true));

    // A different map at the same arena id (Wargaming re-uses them) is a new
    // map, not a rework: start a fresh baseline instead of diffing two maps that
    // have nothing to do with each other. It is an addition all the same, and
    // recording it is what dates the new map: without it the reader is told this
    // map predates our tracking, because the arena id did.
    if (!isSameMap(prev.data, data)) {
      if (!cameBack && !seeding) changes.push(presence(arenaId, true));
      baseline();
      continue;
    }

    for (const change of diffMapSnapshots(prev.data, data)) {
      changes.push({ arenaId, gameVersion, capturedAt, ...change });
    }
    baseline();
  }

  // Maps that were in the client and no longer are. Their last snapshot stays as
  // it was, so if they come back (the seasonal reskins do, every year) the diff
  // picks up from what they looked like when they left.
  //
  // Guarded, because "absent from this read" and "pulled from the game" are not
  // the same thing: the catalogue turns every failed `arena_defs` fetch into a
  // definition-less card, which this pass skips, so one throttled burst against
  // the mirror would look like half the game's maps disappearing. And these rows
  // are permanent (the feed is append-only) and would flip every one of those
  // maps to absent, publishing a matching wave of additions on the next good
  // run. An update pulls a handful of maps; losing a quarter of them at once is
  // the read failing, not Wargaming.
  const known = [...latest.keys()].filter((id) => !absent.has(id));
  const gone = known.filter((id) => !seen.has(id));
  if (gone.length > Math.max(8, known.length * 0.25)) {
    console.warn(
      `[map-history] ${gone.length}/${known.length} maps missing from this read; recording no removals`,
    );
  } else {
    for (const arenaId of gone) changes.push(presence(arenaId, false));
  }

  await insertChunked(snapshots, (chunk) =>
    db.insert(mapSnapshots).values(chunk).onConflictDoNothing(),
  );
  await insertChunked(changes, (chunk) => db.insert(mapChanges).values(chunk));

  return { version: gameVersion, snapshots: snapshots.length, changes: changes.length };
}
