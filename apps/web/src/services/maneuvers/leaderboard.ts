import { asc, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  maneuversClansByRegion,
  maneuversEditionsByRegion,
  maneuversPlayersByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Maneuvers: the recurring Stronghold clan event, read out of the tables a
 * private feeder fills.
 *
 * The two boards are served together rather than one endpoint each, because
 * they describe the same instant: the player standings and the clan standings
 * are recomputed by the source at the same moment, and two calls would let a
 * reader see a cutoff from one pass beside a ranking from the next. It is the
 * same reasoning the marks board is built on.
 *
 * Everything here is returned JSON-ready (ISO strings, no `Date`), because
 * `unstable_cache` round-trips its value through JSON: a `Date` put in comes
 * back as a string on a cache hit but not on a miss, and the two paths then
 * disagree about the shape of their own result.
 */

export type ManeuversEdition = {
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  vehicleLevels: number[];
  /** Places rewarded with a vehicle on the player board, per region. */
  tankRewardPositions: number | null;
  /** Places rewarded with gold on the clan board, per region. */
  clanGoldPositions: number | null;
};

/** Both boards as a whole at the instant the source last recomputed them. */
export type ManeuversStanding = {
  capturedAt: string;
  playerCount: number;
  clanCount: number;
  /**
   * Fame Points held by the player sitting at the last rewarded place. This is
   * the number the event is actually played against, and the source publishes
   * the position rather than the price, so it is read off the board.
   */
  tankCutoffPoints: number | null;
  clanGoldCutoffPoints: number | null;
  topPlayerPoints: number | null;
  topClanPoints: number | null;
};

export type ManeuversPlayerRow = {
  place: number;
  accountId: number;
  nickname: string | null;
  clanId: number | null;
  clanTag: string | null;
  famePoints: number;
  victories: number;
  defeats: number;
};

export type ManeuversClanRow = {
  place: number;
  clanId: number;
  tag: string | null;
  name: string | null;
  famePoints: number;
  victories: number;
  defeats: number;
};

export type ManeuversBoard = {
  edition: ManeuversEdition | null;
  standing: ManeuversStanding | null;
  players: ManeuversPlayerRow[];
  clans: ManeuversClanRow[];
};

/** Rows served by default, and the ceiling a caller can ask for. */
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 1000;

async function readBoard(
  region: Region,
  limit: number,
): Promise<ManeuversBoard> {
  const editions = maneuversEditionsByRegion[region];

  // The newest edition is the one being played, or the last one that was. An
  // edition that has ended keeps its rows, so the page shows a final table
  // rather than an empty one once an edition closes.
  const [edition] = await db
    .select()
    .from(editions)
    .orderBy(desc(editions.startDate))
    .limit(1);

  if (!edition) {
    return { edition: null, standing: null, players: [], clans: [] };
  }

  const snapshots = maneuversSnapshotsByRegion[region];
  const players = maneuversPlayersByRegion[region];
  const clans = maneuversClansByRegion[region];

  const [[snapshot], playerRows, clanRows] = await Promise.all([
    db
      .select()
      .from(snapshots)
      .where(eq(snapshots.eventName, edition.eventName))
      .orderBy(desc(snapshots.capturedAt))
      .limit(1),
    db
      .select()
      .from(players)
      .where(eq(players.eventName, edition.eventName))
      .orderBy(asc(players.place))
      .limit(limit),
    db
      .select()
      .from(clans)
      .where(eq(clans.eventName, edition.eventName))
      .orderBy(asc(clans.place))
      .limit(limit),
  ]);

  return {
    edition: {
      eventName: edition.eventName,
      startDate: edition.startDate?.toISOString() ?? null,
      endDate: edition.endDate?.toISOString() ?? null,
      vehicleLevels: edition.vehicleLevels ?? [],
      tankRewardPositions: edition.tankRewardPositions,
      clanGoldPositions: edition.clanGoldPositions,
    },
    standing: snapshot
      ? {
          capturedAt: snapshot.capturedAt.toISOString(),
          playerCount: snapshot.playerCount,
          clanCount: snapshot.clanCount,
          tankCutoffPoints: snapshot.tankCutoffPoints,
          clanGoldCutoffPoints: snapshot.clanGoldCutoffPoints,
          topPlayerPoints: snapshot.topPlayerPoints,
          topClanPoints: snapshot.topClanPoints,
        }
      : null,
    players: playerRows.map((row) => ({
      place: row.place,
      accountId: row.accountId,
      nickname: row.nickname,
      clanId: row.clanId,
      clanTag: row.clanTag,
      famePoints: row.famePoints,
      victories: row.victories,
      defeats: row.defeats,
    })),
    clans: clanRows.map((row) => ({
      place: row.place,
      clanId: row.clanId,
      tag: row.tag,
      name: row.name,
      famePoints: row.famePoints,
      victories: row.victories,
      defeats: row.defeats,
    })),
  };
}

const readBoardCached = unstable_cache(readBoard, ["maneuvers-board"], {
  // The source recomputes on its own interval and the feeder follows it, so
  // anything finer than a pass serves the same rows twice. A minute is short
  // enough that a reader refreshing during a prime time sees movement, and
  // long enough that a board of a thousand rows is not rebuilt per visitor.
  revalidate: 60,
});

export function getManeuversBoard(
  region: Region,
  limit: number = DEFAULT_LIMIT,
): Promise<ManeuversBoard> {
  const clamped = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  return readBoardCached(region, clamped);
}
