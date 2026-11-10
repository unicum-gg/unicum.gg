import { asc, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  maneuversEditionsByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** One capture of an edition, as the race panel draws it. */
export type ManeuversHistoryPoint = {
  /** The source's recalculation instant, epoch seconds. */
  t: number;
  playerCount: number;
  clanCount: number;
  tankCutoffPoints: number | null;
  clanGoldCutoffPoints: number | null;
};

export type ManeuversHistory = {
  eventName: string;
  points: ManeuversHistoryPoint[];
};

/**
 * How an edition's boards moved while it ran, one point per capture: what a
 * vehicle place and a gold place cost, and how many held a place. The source
 * serves only the current instant, so the series exists because the feeder
 * recorded it, and it starts the day the feeder first ran.
 *
 * Read off the per-capture snapshot rows, a few hundred a day, rather than the
 * per-entry history, which is that times the size of the board.
 */
async function readHistory(
  region: Region,
  eventName: string | null,
): Promise<ManeuversHistory | null> {
  const editions = maneuversEditionsByRegion[region];
  const [edition] = eventName
    ? await db
        .select({ eventName: editions.eventName })
        .from(editions)
        .where(eq(editions.eventName, eventName))
    : await db
        .select({ eventName: editions.eventName })
        .from(editions)
        .orderBy(desc(editions.startDate))
        .limit(1);
  if (!edition) return null;

  const snapshots = maneuversSnapshotsByRegion[region];
  const rows = await db
    .select({
      capturedAt: snapshots.capturedAt,
      playerCount: snapshots.playerCount,
      clanCount: snapshots.clanCount,
      tankCutoffPoints: snapshots.tankCutoffPoints,
      clanGoldCutoffPoints: snapshots.clanGoldCutoffPoints,
    })
    .from(snapshots)
    .where(eq(snapshots.eventName, edition.eventName))
    .orderBy(asc(snapshots.capturedAt));

  return {
    eventName: edition.eventName,
    points: rows.map((r) => ({
      t: Math.floor(r.capturedAt.getTime() / 1000),
      playerCount: r.playerCount,
      clanCount: r.clanCount,
      tankCutoffPoints: r.tankCutoffPoints,
      clanGoldCutoffPoints: r.clanGoldCutoffPoints,
    })),
  };
}

const readHistoryCached = unstable_cache(readHistory, ["maneuvers-history"], {
  // The feeder captures every few minutes; the board read beside it caches a
  // minute for the same reason.
  revalidate: 60,
});

/** One edition's capture series, the newest edition when `eventName` is null. */
export function getManeuversHistory(
  region: Region,
  eventName: string | null = null,
): Promise<ManeuversHistory | null> {
  return readHistoryCached(region, eventName);
}
