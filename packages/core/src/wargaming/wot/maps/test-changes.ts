import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  diffMapSnapshots,
  isSameMap,
  MAP_PRESENCE_FIELD,
  MAP_PRESENT,
  mapTestChanges,
  type MapSnapshotData,
  type NewMapTestChange,
} from "@unicum.gg/shared";

/** One thing the test build changes about a map, with both sides. */
export type MapTestChangeEntry = {
  field: string;
  /** The live client's value. */
  previous: string | null;
  /** The test client's value. */
  next: string | null;
};

/**
 * Record what the Common Test client changes about the game's maps.
 *
 * The map half of what the tank test diff does: the test build is where a
 * reworked spawn, a resized play area or a new map shows up weeks before it
 * ships, and Wargaming's API says nothing about any of it. A map the test build
 * has and the live client does not is recorded as a presence change, so a new
 * map announces itself in the same feed as a reworked one.
 *
 * The table is replaced rather than appended to: a test build is re-cut mid-test
 * and disappears when it ships, so yesterday's diff is noise. What shipped lives
 * in `map_changes`, which is append-only.
 */
export async function recordMapTestChanges(
  live: Map<string, MapSnapshotData>,
  test: Map<string, MapSnapshotData>,
  testVersion: string,
): Promise<number> {
  const rows: NewMapTestChange[] = [];
  const capturedAt = new Date();

  for (const [arenaId, data] of test) {
    const before = live.get(arenaId);
    if (!before) {
      // Only on the test client: a map that is coming, not a map that changed.
      // Unless the test client merely *names* it: the localization keeps arenas
      // the game no longer has, and the live and test clients do not carry the
      // same set, so an id known from a `.po` alone is a gap in what we can read
      // rather than a map about to arrive (the live pipeline skips those too).
      if (!data.defined) continue;
      rows.push({
        arenaId,
        testVersion,
        field: MAP_PRESENCE_FIELD,
        previous: null,
        next: MAP_PRESENT,
        capturedAt,
      });
      continue;
    }
    // A different map at the same arena id is not a rework of the live one.
    if (!isSameMap(before, data)) continue;
    for (const change of diffMapSnapshots(before, data)) {
      rows.push({ arenaId, testVersion, capturedAt, ...change });
    }
  }

  // Swap in one transaction: a reader must never see the table half-empty, and
  // a test build that changes nothing correctly leaves nothing behind.
  await db.transaction(async (tx) => {
    await tx.delete(mapTestChanges);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      if (chunk.length > 0) await tx.insert(mapTestChanges).values(chunk);
    }
  });
  return rows.length;
}

/**
 * Forget the pending test changes: the build shipped, or the test branch turned
 * out not to be ahead of the live one. What it changed is either live now (and
 * `map_changes` has it) or was never real.
 */
export async function clearMapTestChanges(): Promise<void> {
  await db.delete(mapTestChanges);
}

/** How many things the test build changes, per arena id. Empty when no test is
 * running. Small enough to read whole (a test touches a few maps). */
export async function getMapTestChangeCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      arenaId: mapTestChanges.arenaId,
      count: sql<number>`count(*)::int`,
    })
    .from(mapTestChanges)
    .groupBy(mapTestChanges.arenaId);
  return new Map(rows.map((r) => [r.arenaId, r.count]));
}

/** Everything the running test build changes about one map, with the build it
 * was read from. `version` is null when nothing is pending for this map. */
export async function getMapTestChanges(
  arenaId: string,
): Promise<{ version: string | null; changes: MapTestChangeEntry[] }> {
  const rows = await db
    .select()
    .from(mapTestChanges)
    .where(sql`${mapTestChanges.arenaId} = ${arenaId}`);
  return {
    version: rows[0]?.testVersion ?? null,
    changes: rows.map((r) => ({
      field: r.field,
      previous: r.previous,
      next: r.next,
    })),
  };
}
