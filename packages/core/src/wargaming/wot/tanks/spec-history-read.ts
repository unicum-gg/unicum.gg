import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  buildTankSlugIndex,
  tankChanges,
  tankIntroductions,
  type VehicleMeta,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import type { SpecChange } from "@unicum.gg/core/wargaming/wot/tanks/spec-history";

// Read side of the tank changes history (the write/diff side, plus the shared
// `SpecChange` type, lives in `spec-history.ts`). Query-only: the per-tank
// History tab and the global changes feed.

export type TankChangeVersion = {
  gameVersion: string;
  capturedAt: Date;
  changes: SpecChange[];
};

export type TankLifecycle = {
  /** The version the tank first appeared in the client as a dev stub (placeholder
   * stats, before balancing), or null when it predates our tracking window. */
  devVersion: string | null;
  devAt: Date | null;
  /** The version the tank was released in (its first real, playable spec), or
   * null when it predates our tracking window. */
  releasedVersion: string | null;
  releasedAt: Date | null;
};

/**
 * A tank's full characteristics history, grouped by game version (newest first),
 * plus its lifecycle (dev-stub appearance and release), from `tank_introductions`.
 * Null when the slug maps to no tank.
 */
export async function getTankSpecHistory(
  region: Region,
  slug: string,
): Promise<
  | ({
      tankId: number;
      slug: string;
      meta: VehicleMeta;
      versions: TankChangeVersion[];
    } & TankLifecycle)
  | null
> {
  const tank = await getTankBySlug(region, slug);
  if (!tank) return null;

  const [rows, [life]] = await Promise.all([
    db
      .select({
        gameVersion: tankChanges.gameVersion,
        capturedAt: tankChanges.capturedAt,
        field: tankChanges.field,
        previous: tankChanges.previous,
        next: tankChanges.next,
      })
      .from(tankChanges)
      .where(eq(tankChanges.tankId, tank.tankId))
      .orderBy(desc(tankChanges.capturedAt)),
    db
      .select({
        devVersion: tankIntroductions.devVersion,
        devAt: tankIntroductions.devAt,
        releasedVersion: tankIntroductions.releasedVersion,
        releasedAt: tankIntroductions.releasedAt,
      })
      .from(tankIntroductions)
      .where(eq(tankIntroductions.tankId, tank.tankId))
      .limit(1),
  ]);

  return {
    tankId: tank.tankId,
    slug: tank.slug,
    meta: tank.meta,
    versions: groupByVersion(rows),
    devVersion: life?.devVersion ?? null,
    devAt: life?.devAt ?? null,
    releasedVersion: life?.releasedVersion ?? null,
    releasedAt: life?.releasedAt ?? null,
  };
}

export type TankChangeIdentity = VehicleMeta & { tankId: number; slug: string };
export type ChangedTank = {
  identity: TankChangeIdentity;
  changes: SpecChange[];
};
export type FeedVersion = {
  gameVersion: string;
  capturedAt: Date;
  tanks: ChangedTank[];
};

/**
 * The global tank-changes feed for a region: recent balance changes across all
 * tanks, grouped by game version (newest first) and then by tank. Identity
 * (name, icons, slug) comes from the region's own catalogue, so a tank absent
 * from a server is left out of that server's feed.
 */
export async function getRecentSpecChanges(
  region: Region,
  { versionLimit = 12 }: { versionLimit?: number } = {},
): Promise<FeedVersion[]> {
  // The most recent distinct versions that produced changes, newest first.
  const versionRows = await db
    .select({
      gameVersion: tankChanges.gameVersion,
      capturedAt: sql<Date>`max(${tankChanges.capturedAt})`,
    })
    .from(tankChanges)
    .groupBy(tankChanges.gameVersion)
    .orderBy(desc(sql`max(${tankChanges.capturedAt})`))
    .limit(versionLimit);
  if (versionRows.length === 0) return [];

  const versions = versionRows.map((v) => v.gameVersion);
  const [rows, encyclopedia] = await Promise.all([
    db
      .select({
        gameVersion: tankChanges.gameVersion,
        capturedAt: tankChanges.capturedAt,
        tankId: tankChanges.tankId,
        field: tankChanges.field,
        previous: tankChanges.previous,
        next: tankChanges.next,
      })
      .from(tankChanges)
      .where(inArray(tankChanges.gameVersion, versions))
      .orderBy(desc(tankChanges.capturedAt)),
    getVehicleEncyclopedia(region),
  ]);
  const slugIndex = buildTankSlugIndex(encyclopedia).idToSlug;

  const byVersion = new Map<
    string,
    { capturedAt: Date; tanks: Map<number, SpecChange[]> }
  >();
  for (const r of rows) {
    let group = byVersion.get(r.gameVersion);
    if (!group) {
      group = { capturedAt: r.capturedAt, tanks: new Map() };
      byVersion.set(r.gameVersion, group);
    }
    if (r.capturedAt > group.capturedAt) group.capturedAt = r.capturedAt;
    const list = group.tanks.get(r.tankId) ?? [];
    list.push({ field: r.field, previous: r.previous, next: r.next });
    group.tanks.set(r.tankId, list);
  }

  const feed: FeedVersion[] = [];
  for (const version of versions) {
    const group = byVersion.get(version);
    if (!group) continue;
    const tanks: ChangedTank[] = [];
    for (const [tankId, changes] of group.tanks) {
      const meta = encyclopedia[String(tankId)];
      const slug = slugIndex.get(tankId);
      if (!meta || !slug) continue; // not in this region's catalogue
      tanks.push({ identity: { ...meta, tankId, slug }, changes });
    }
    if (tanks.length === 0) continue;
    // Heaviest-hit tanks first within a version.
    tanks.sort((a, b) => b.changes.length - a.changes.length);
    feed.push({ gameVersion: version, capturedAt: group.capturedAt, tanks });
  }
  return feed;
}

function groupByVersion(
  rows: {
    gameVersion: string;
    capturedAt: Date;
    field: string;
    previous: number | null;
    next: number | null;
  }[],
): TankChangeVersion[] {
  const byVersion = new Map<string, TankChangeVersion>();
  for (const r of rows) {
    let group = byVersion.get(r.gameVersion);
    if (!group) {
      group = { gameVersion: r.gameVersion, capturedAt: r.capturedAt, changes: [] };
      byVersion.set(r.gameVersion, group);
    }
    if (r.capturedAt > group.capturedAt) group.capturedAt = r.capturedAt;
    group.changes.push({ field: r.field, previous: r.previous, next: r.next });
  }
  return [...byVersion.values()];
}
