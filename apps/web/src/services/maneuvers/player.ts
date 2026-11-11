import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  maneuversEditionsByRegion,
  maneuversPlayerHistoryByRegion,
  maneuversPlayersByRegion,
  maneuversSnapshotsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { readManeuversBoard } from "@/services/maneuvers/leaderboard";

/** Where the player stood on one edition's board: the live place for the
 * edition being played, the last one recorded for an edition that ended. */
export type PlayerManeuversEdition = {
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  place: number;
  famePoints: number;
  /** How many held a place on the board at its last capture. */
  ranked: number | null;
  /** Places that win the vehicle on this edition, on this server. */
  rewardPositions: number | null;
  clanId: number | null;
  clanTag: string | null;
};

export type PlayerManeuversPoint = {
  /** Capture instant, epoch seconds. */
  t: number;
  place: number;
  famePoints: number;
};

export type PlayerManeuvers = {
  accountId: number;
  nickname: string;
  /** The newest edition recorded on the server, whether or not they are on
   * it, so the tab can say the edition is running without them. */
  latest: { eventName: string; startDate: string | null; endDate: string | null } | null;
  /** Their row on the newest edition, with the day's move. Null when they
   * hold no place on it. */
  current:
    | (PlayerManeuversEdition & {
        gain24h: number | null;
        placeChange24h: number | null;
      })
    | null;
  /** Their climb through the newest edition, one point per capture that
   * moved them. */
  history: PlayerManeuversPoint[];
  /** Every edition they held a place on, newest first. */
  editions: PlayerManeuversEdition[];
};

/**
 * A player's Maneuvers record, read off our own capture of the boards: the
 * source publishes the current board and nothing per player, so everything
 * here exists because the feeder recorded it.
 *
 * The nickname resolves against our players table, like the Onslaught record,
 * and falls back to the name the board itself carried, since the board ranks
 * accounts we may never have looked up. Null when neither knows it.
 */
export async function getPlayerManeuvers(
  region: Region,
  nickname: string,
): Promise<PlayerManeuvers | null> {
  const account = await resolveAccount(region, nickname);
  if (!account) return null;

  const editions = maneuversEditionsByRegion[region];
  const entries = maneuversPlayersByRegion[region];
  const snapshots = maneuversSnapshotsByRegion[region];

  const [held, rows, counts] = await Promise.all([
    db.select().from(editions).orderBy(sql`${editions.startDate} DESC NULLS LAST`),
    db
      .select({
        eventName: entries.eventName,
        place: entries.place,
        famePoints: entries.famePoints,
        clanId: entries.clanId,
        clanTag: entries.clanTag,
      })
      .from(entries)
      .where(eq(entries.accountId, account.accountId)),
    // Each edition's field at its last capture, which is what a final place
    // is read against. One row per edition, off the snapshot primary key.
    db
      .selectDistinctOn([snapshots.eventName], {
        eventName: snapshots.eventName,
        playerCount: snapshots.playerCount,
      })
      .from(snapshots)
      .orderBy(snapshots.eventName, desc(snapshots.capturedAt)),
  ]);

  const byEvent = new Map(rows.map((r) => [r.eventName, r]));
  const fieldOf = new Map(counts.map((c) => [c.eventName, c.playerCount]));
  const recorded: PlayerManeuversEdition[] = held.flatMap((e) => {
    const row = byEvent.get(e.eventName);
    if (!row) return [];
    return [
      {
        eventName: e.eventName,
        startDate: e.startDate?.toISOString() ?? null,
        endDate: e.endDate?.toISOString() ?? null,
        place: row.place,
        famePoints: Number(row.famePoints),
        ranked: fieldOf.get(e.eventName) ?? null,
        rewardPositions: e.tankRewardPositions,
        clanId: row.clanId == null ? null : Number(row.clanId),
        clanTag: row.clanTag,
      },
    ];
  });

  const newest = held[0] ?? null;
  const onNewest = newest
    ? recorded.find((r) => r.eventName === newest.eventName) ?? null
    : null;

  // The day's move comes off the whole board the leaderboard already holds in
  // memory, so it is the same figure the board shows beside their name.
  const [board, history] = onNewest
    ? await Promise.all([
        readManeuversBoard(region, onNewest.eventName),
        readClimb(region, onNewest.eventName, account.accountId),
      ])
    : [null, []];
  const row = board?.players.find((p) => p.accountId === account.accountId);

  return {
    accountId: account.accountId,
    nickname: account.nickname,
    latest: newest
      ? {
          eventName: newest.eventName,
          startDate: newest.startDate?.toISOString() ?? null,
          endDate: newest.endDate?.toISOString() ?? null,
        }
      : null,
    current: onNewest
      ? {
          ...onNewest,
          gain24h: row?.gain24h ?? null,
          placeChange24h: row?.placeChange24h ?? null,
        }
      : null,
    history,
    editions: recorded,
  };
}

async function resolveAccount(
  region: Region,
  nickname: string,
): Promise<{ accountId: number; nickname: string } | null> {
  const players = playersByRegion[region];
  // Case-insensitive against `lower(nickname)`, which is what the index is on.
  const [known] = await db
    .select({ accountId: players.accountId, nickname: players.nickname })
    .from(players)
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
    .limit(1);
  if (known) return { accountId: Number(known.accountId), nickname: known.nickname };

  const entries = maneuversPlayersByRegion[region];
  const [seen] = await db
    .select({ accountId: entries.accountId, nickname: entries.nickname })
    .from(entries)
    .where(sql`LOWER(${entries.nickname}) = LOWER(${nickname})`)
    .orderBy(desc(entries.updatedAt))
    .limit(1);
  return seen?.nickname
    ? { accountId: Number(seen.accountId), nickname: seen.nickname }
    : null;
}

/** Every recorded move of one account through one edition, oldest first. */
async function readClimb(
  region: Region,
  eventName: string,
  accountId: number,
): Promise<PlayerManeuversPoint[]> {
  const history = maneuversPlayerHistoryByRegion[region];
  const rows = await db
    .select({
      capturedAt: history.capturedAt,
      place: history.place,
      famePoints: history.famePoints,
    })
    .from(history)
    .where(and(eq(history.eventName, eventName), eq(history.accountId, accountId)))
    .orderBy(asc(history.capturedAt));
  return rows.map((r) => ({
    t: Math.floor(r.capturedAt.getTime() / 1000),
    place: r.place,
    famePoints: Number(r.famePoints),
  }));
}
