import { desc, inArray } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { mapChanges, mapTestChanges } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { listMapSummaries } from "./index";
import {
  attachChange,
  currentBuildRows,
  testOnlyArenas,
  type ChangedMap,
  type MapChangeEntryRow,
} from "./history-read";

/**
 * What the reader is shown as not-yet-playable, per map.
 *
 * `version` is the running Common Test build, and it is null when none is
 * running. `maps` can still be non-empty then: an arena the live client
 * declares but ships no space for has recorded changes of its own, and those
 * are pending whether or not a test is running. The panel omits the build
 * number in that case rather than inventing one.
 */
export type PendingMapChanges = {
  version: string | null;
  maps: ChangedMap[];
};

/**
 * What is waiting rather than shipped: the running Common Test build's changes,
 * plus the recorded changes of the arenas the live client cannot load.
 *
 * The pending half of `getRecentMapChanges`, read from two tables because they
 * are two different kinds of thing. `map_test_changes` is the test build's diff
 * against live: replaced at every run, gone when the test is. `map_changes` is
 * what the client itself changed and is append-only, but a row about a space no
 * live server can load has not shipped either, whatever version it arrived in.
 * They are presented as one block rather than as a version in the feed for the
 * same reason.
 *
 * Filtered to the catalogue like the shipped feed: the test build's new arenas
 * are mostly mode variants (the Onslaught night ones) with no metadata and no
 * page to link to, and a line the reader cannot follow is worse than no line.
 */
export async function getPendingMapChanges(
  region: Region,
): Promise<PendingMapChanges> {
  const [summaries, rows] = await Promise.all([
    listMapSummaries(region),
    db.select().from(mapTestChanges).orderBy(mapTestChanges.arenaId),
  ]);

  const byId = new Map(summaries.map((m) => [m.arenaId, m]));
  const testOnly = testOnlyArenas(summaries);
  // Scoped to those arenas, and skipped entirely when there are none: this
  // table holds every change ever recorded about every map (the backfill alone
  // put 38 versions in it) and grows by a patch's worth at each update, so
  // reading all of it to keep ten arenas' rows gets worse every month. The read
  // waits on the catalogue rather than racing it, which costs nothing: the
  // catalogue is memoized per region.
  const unshipped =
    testOnly.size === 0
      ? []
      : await db
          .select()
          .from(mapChanges)
          .where(inArray(mapChanges.arenaId, [...testOnly]))
          .orderBy(desc(mapChanges.capturedAt));

  const pendingRows = [
    ...rows.map((r) => ({
      arenaId: r.arenaId,
      field: r.field,
      previous: r.previous,
      next: r.next,
    })),
    ...currentBuildRows(unshipped).map((r) => ({
      arenaId: r.arenaId,
      field: r.field,
      previous: r.previous,
      next: r.next,
    })),
  ];
  if (pendingRows.length === 0) return { version: null, maps: [] };

  const byArena = new Map<string, MapChangeEntryRow[]>();
  for (const row of pendingRows) {
    const on = attachChange(row.arenaId, row.field, (id) => byId.has(id));
    if (!on) continue;
    const entries = byArena.get(on.arenaId) ?? [];
    entries.push({ field: on.field, previous: row.previous, next: row.next });
    byArena.set(on.arenaId, entries);
  }

  return {
    // The build is read from the rows themselves rather than from the catalogue
    // filter, so a test that only touches uncatalogued arenas is still reported
    // as running instead of looking like no test at all.
    version: rows[0]?.testVersion ?? null,
    maps: [...byArena]
      .map(([arenaId, changes]) => {
        const map = byId.get(arenaId);
        return {
          arenaId,
          slug: map?.slug ?? arenaId,
          name: map?.name ?? arenaId,
          minimapUrl: map?.minimapUrl ?? "",
          commonTest: map?.commonTest ?? false,
          variantCommonTest: map?.variants.some((v) => v.commonTest) ?? false,
          changes,
        };
      })
      .sort((a, b) => b.changes.length - a.changes.length),
  };
}
