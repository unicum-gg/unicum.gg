import { and, desc, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  foldedMapChangeField,
  MAP_PRESENCE_FIELD,
  mapChanges,
  mapSnapshots,
  mapTestChanges,
  variantOf,
  type MapChange,
  type MapSummary,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { listMapSummaries } from "./index";

/** One recorded change, as a page reads it. */
export type MapChangeEntryRow = {
  field: string;
  previous: string | null;
  next: string | null;
};

/** A game version and everything it changed about a map, newest first. */
export type MapVersionChanges = {
  gameVersion: string;
  capturedAt: Date;
  changes: MapChangeEntryRow[];
};

/** A map's whole recorded history, plus when it entered the game. */
export type MapHistory = {
  versions: MapVersionChanges[];
  /** Changes recorded on a space the live client does not ship yet: the client
   * declares the arena, so the rows exist, but nothing here has happened on a
   * live server. They are handed back apart from the shipped history so the page
   * can put them where the test build's own pending changes go. */
  pending: MapChangeEntryRow[];
  /** The version the map was added in, null when it predates the tracking
   * window (in which case the reader is told it came before the first tracked
   * update rather than shown nothing). */
  addedVersion: string | null;
  addedAt: Date | null;
  /** Set when the map is currently gone from the client, with the version that
   * pulled it. The seasonal maps come back, so this is a state and not an end. */
  removedVersion: string | null;
  removedAt: Date | null;
  /** Whether the client currently ships the map. */
  present: boolean;
  /** Whether we have ever recorded this map. False for the arenas the client
   * names but does not define, which have nothing to track and no knowable
   * introduction: a page shows no history panel at all rather than claiming the
   * map predates the tracking window. */
  tracked: boolean;
};

function groupByVersion(rows: MapChange[]): MapVersionChanges[] {
  const byVersion = new Map<string, MapVersionChanges>();
  for (const row of rows) {
    const existing = byVersion.get(row.gameVersion);
    if (existing) {
      existing.changes.push({
        field: row.field,
        previous: row.previous,
        next: row.next,
      });
      // An update is dated by when it landed, not by the last row we happened to
      // write for it: a later run (a hotfix build of the same update) appends
      // rows today, and dating the whole version from those would move a
      // year-old update to this morning.
      if (row.capturedAt < existing.capturedAt) existing.capturedAt = row.capturedAt;
      continue;
    }
    byVersion.set(row.gameVersion, {
      gameVersion: row.gameVersion,
      capturedAt: row.capturedAt,
      changes: [{ field: row.field, previous: row.previous, next: row.next }],
    });
  }
  return [...byVersion.values()].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
}

/**
 * Everything recorded about one map, newest version first.
 *
 * Only the history of the map that holds the arena id *now* is returned:
 * Wargaming re-uses ids, and the snapshots carry the display name, so the run of
 * changes that belongs to a previous occupant is left behind rather than
 * presented as this map's past.
 */
export async function getMapHistory(
  arenaId: string,
  /** The map's variant arenas, whose changes belong on this page: they are
   * folded onto this map and have no page of their own. */
  variantArenaIds: string[] = [],
  /** The arenas among those whose space only the test client ships. Their rows
   * are pending, not history. */
  testOnly: ReadonlySet<string> = new Set(),
): Promise<MapHistory> {
  const ids = [arenaId, ...variantArenaIds];
  const [rows, names] = await Promise.all([
    db
      .select()
      .from(mapChanges)
      .where(inArray(mapChanges.arenaId, ids))
      .orderBy(desc(mapChanges.capturedAt)),
    db
      .select({
        name: mapSnapshots.name,
        gameVersion: mapSnapshots.gameVersion,
        capturedAt: mapSnapshots.capturedAt,
      })
      .from(mapSnapshots)
      .where(sql`${mapSnapshots.arenaId} = ${arenaId}`)
      .orderBy(desc(mapSnapshots.capturedAt)),
  ]);

  // The current occupant's window: walking back from the newest snapshot for as
  // long as the name holds, and stopping at the first one that differs. Filtering
  // on the name instead would jump back over an intervening occupant whenever an
  // id held a name, lost it, and got it again, and hand this map that other
  // map's history — the very thing this guards against.
  const current = names[0]?.name;
  let since: Date | null = null;
  for (const snapshot of names) {
    if (snapshot.name !== current) break;
    since = snapshot.capturedAt;
  }
  const inWindow = since
    ? rows.filter((r) => r.capturedAt.getTime() >= since.getTime())
    : rows;
  // The night arena's rows read as this map's, under the field that says which
  // of the two they describe.
  const asMine = (r: MapChange): MapChange => {
    if (r.arenaId === arenaId) return r;
    const battleType = variantOf(r.arenaId)?.battleType;
    return battleType
      ? { ...r, arenaId, field: foldedMapChangeField(battleType, r.field) }
      : { ...r, arenaId };
  };
  // A row about a space the live client does not ship is not history yet: it
  // leaves the versions for the pending block, where the test build's own
  // changes go. Split on the arena it was recorded against, before the fold
  // rewrites it.
  const unshipped = new Set(
    currentBuildRows(inWindow.filter((r) => testOnly.has(r.arenaId))),
  );
  const shipped = inWindow.filter((r) => !unshipped.has(r)).map(asMine);
  const pending = [...unshipped]
    .map(asMine)
    .map(({ field, previous, next }) => ({ field, previous, next }));

  // Presence is the map's own, and only what shipped: a map whose space the live
  // client does not carry has not entered the game, whatever its arena
  // definition says.
  const presence = shipped.filter((r) => r.field === MAP_PRESENCE_FIELD);
  const lastPresence = presence[0] ?? null;
  const firstAdded = presence.filter((r) => r.next !== null).at(-1) ?? null;
  const present = !lastPresence || lastPresence.next !== null;

  return {
    tracked: names.length > 0,
    versions: groupByVersion(shipped),
    pending,
    addedVersion: firstAdded?.gameVersion ?? null,
    addedAt: firstAdded?.capturedAt ?? null,
    removedVersion: present ? null : (lastPresence?.gameVersion ?? null),
    removedAt: present ? null : (lastPresence?.capturedAt ?? null),
    present,
  };
}

/** Whether a map has anything to show on a History tab: a recorded change, or a
 * baseline proving we have been watching it (in which case the tab still says
 * when it entered the game, or that it predates the window). */
export async function getMapHasHistory(arenaId: string): Promise<boolean> {
  const rows = await db
    .select({ arenaId: mapSnapshots.arenaId })
    .from(mapSnapshots)
    .where(sql`${mapSnapshots.arenaId} = ${arenaId}`)
    .limit(1);
  return rows.length > 0;
}

/** A map and what one game version changed about it (global feed view). */
export type ChangedMap = {
  arenaId: string;
  slug: string;
  name: string;
  minimapUrl: string;
  /** Whether one of this map's variants is only on the test client, so a row
   * about it can say so rather than reading as something playable today. */
  variantCommonTest: boolean;
  changes: MapChangeEntryRow[];
};

/** A game version and every map it changed. */
export type MapFeedVersion = {
  gameVersion: string;
  capturedAt: Date;
  maps: ChangedMap[];
};

/**
 * The most recent game versions that changed anything about the game's maps,
 * newest first, each with the maps it touched (most-changed first).
 *
 * Restricted to the maps the catalogue currently lists: the client keeps a long
 * tail of event arenas and mode variants nobody can play, and a feed of what
 * changed is only useful if every line names a map the reader can go and look
 * at. That also quietly drops the housekeeping the client does to maps it
 * retired years ago.
 */
/**
 * The map a recorded change belongs to on the site, and the field it reads as
 * there. An arena of its own answers for itself; a night arena answers for the
 * map it was folded onto, since that is the only page it has.
 *
 * Returns null for an arena the catalogue does not list at all, which is what
 * keeps the client's long tail of retired event arenas out of the feed.
 */
function attachChange(
  arenaId: string,
  field: string,
  listed: (id: string) => boolean,
): { arenaId: string; field: string } | null {
  if (listed(arenaId)) return { arenaId, field };
  const variant = variantOf(arenaId);
  if (variant?.foldedIntoBase && variant.battleType && listed(variant.baseId)) {
    return {
      arenaId: variant.baseId,
      field: foldedMapChangeField(variant.battleType, field),
    };
  }
  return null;
}

export async function getRecentMapChanges(
  region: Region,
  { versionLimit = 12 }: { versionLimit?: number } = {},
): Promise<MapFeedVersion[]> {
  const summaries = await listMapSummaries(region);
  const byId = new Map(summaries.map((m) => [m.arenaId, m]));
  if (byId.size === 0) return [];
  // The night arenas are read too, since their changes belong to the map they
  // are folded onto. They are not in `byId`, which stays the set of maps that
  // have a page.
  const tracked = [
    ...byId.keys(),
    ...summaries.flatMap((m) => m.variants.map((v) => v.arenaId)),
  ];
  const testOnly = testOnlyArenas(summaries);

  // The versions to show, before their contents: the feed keeps the most recent
  // handful, and the table grows by a patch's worth of rows at every update, so
  // reading all of it to then drop most of it gets steadily more wasteful.
  const versionRows = await db
    .select({
      gameVersion: mapChanges.gameVersion,
      capturedAt: sql<Date>`min(${mapChanges.capturedAt})`,
    })
    .from(mapChanges)
    .where(inArray(mapChanges.arenaId, tracked))
    .groupBy(mapChanges.gameVersion)
    .orderBy(desc(sql`min(${mapChanges.capturedAt})`))
    .limit(versionLimit);
  if (versionRows.length === 0) return [];

  const rows = await db
    .select()
    .from(mapChanges)
    .where(
      and(
        inArray(mapChanges.arenaId, tracked),
        inArray(
          mapChanges.gameVersion,
          versionRows.map((v) => v.gameVersion),
        ),
      ),
    )
    .orderBy(desc(mapChanges.capturedAt), desc(mapChanges.id));

  // The rows describing a space the live client cannot load today: they left
  // history for the pending block, which reads them from the same table.
  const unshipped = new Set(
    currentBuildRows(rows.filter((r) => testOnly.has(r.arenaId))).map(
      (r) => r.id,
    ),
  );

  const byVersion = new Map<
    string,
    { capturedAt: Date; maps: Map<string, MapChangeEntryRow[]> }
  >();
  for (const row of rows) {
    if (unshipped.has(row.id)) continue;
    const on = attachChange(row.arenaId, row.field, (id) => byId.has(id));
    if (!on) continue;
    let group = byVersion.get(row.gameVersion);
    if (!group) {
      group = { capturedAt: row.capturedAt, maps: new Map() };
      byVersion.set(row.gameVersion, group);
    }
    if (row.capturedAt < group.capturedAt) group.capturedAt = row.capturedAt;
    const entries = group.maps.get(on.arenaId) ?? [];
    entries.push({ field: on.field, previous: row.previous, next: row.next });
    group.maps.set(on.arenaId, entries);
  }

  return [...byVersion]
    .map(([gameVersion, group]) => ({
      gameVersion,
      capturedAt: group.capturedAt,
      maps: [...group.maps]
        .map(([arenaId, changes]) => {
          const map = byId.get(arenaId);
          return {
            arenaId,
            slug: map?.slug ?? arenaId,
            name: map?.name ?? arenaId,
            minimapUrl: map?.minimapUrl ?? "",
            variantCommonTest:
              map?.variants.some((v) => v.commonTest) ?? false,
            changes,
          };
        })
        .sort((a, b) => b.changes.length - a.changes.length),
    }))
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
}

/**
 * Of an arena's rows, the ones that describe the state the client is in now:
 * those of the newest version it was recorded at.
 *
 * What makes a row pending is that the live client cannot load the space it
 * describes *today*. The seasonal arenas (the Waffenträger reskins, the arcade
 * minigames) have come and gone for years, and those past arrivals were real:
 * they shipped, were played, and left. Only the latest one is waiting.
 */
function currentBuildRows<T extends { arenaId: string; gameVersion: string }>(
  rows: T[],
): T[] {
  const newest = new Map<string, string>();
  for (const r of rows) {
    if (!newest.has(r.arenaId)) newest.set(r.arenaId, r.gameVersion);
  }
  return rows.filter((r) => newest.get(r.arenaId) === r.gameVersion);
}

/** The arenas a catalogue's maps hold whose space only the test client ships,
 * the map's own and its night version's alike. */
function testOnlyArenas(summaries: MapSummary[]): Set<string> {
  const out = new Set<string>();
  for (const m of summaries) {
    if (m.commonTest) out.add(m.arenaId);
    for (const v of m.variants) if (v.commonTest) out.add(v.arenaId);
  }
  return out;
}

/** What the running Common Test is about to change, per map. `version` is null
 * when no test is running (or the branch is not ahead of live), in which case
 * `maps` is empty. */
export type PendingMapChanges = {
  version: string | null;
  maps: ChangedMap[];
};

/**
 * What the running Common Test build changes about the game's maps, for the
 * global feed.
 *
 * The pending half of `getRecentMapChanges`, read from a different table because
 * it is a different kind of thing: `map_changes` is what shipped and is
 * append-only, `map_test_changes` is replaced at every run and disappears when
 * the test does. It is presented as one block rather than as a version in the
 * feed for the same reason.
 *
 * Filtered to the catalogue like the shipped feed: the test build's new arenas
 * are mostly mode variants (the Onslaught night ones) with no metadata and no
 * page to link to, and a line the reader cannot follow is worse than no line.
 */
export async function getPendingMapChanges(
  region: Region,
): Promise<PendingMapChanges> {
  const [summaries, rows, unshipped] = await Promise.all([
    listMapSummaries(region),
    db.select().from(mapTestChanges).orderBy(mapTestChanges.arenaId),
    // The recorded changes of the arenas the live client declares but does not
    // ship. They are in `map_changes` (the client did change), yet nothing about
    // them has reached a live server, so they read as pending beside whatever
    // the running test is about to do.
    db.select().from(mapChanges).orderBy(desc(mapChanges.capturedAt)),
  ]);

  const byId = new Map(summaries.map((m) => [m.arenaId, m]));
  const testOnly = testOnlyArenas(summaries);
  const pendingRows = [
    ...rows.map((r) => ({ arenaId: r.arenaId, field: r.field, previous: r.previous, next: r.next })),
    ...currentBuildRows(
      unshipped.filter((r) => testOnly.has(r.arenaId)),
    ).map((r) => ({
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
          variantCommonTest: map?.variants.some((v) => v.commonTest) ?? false,
          changes,
        };
      })
      .sort((a, b) => b.changes.length - a.changes.length),
  };
}
