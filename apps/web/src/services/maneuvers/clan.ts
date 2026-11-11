import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { getClanIdByAddress } from "@unicum.gg/core/clans/address";
import {
  clansByRegion,
  maneuversClanHistoryByRegion,
  maneuversClansByRegion,
  maneuversEditionsByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  type ManeuversPlayerRow,
  readManeuversBoard,
} from "@/services/maneuvers/leaderboard";

/** Where the clan stood on one edition's board. */
export type ClanManeuversEdition = {
  eventName: string;
  startDate: string | null;
  endDate: string | null;
  place: number;
  famePoints: number;
  /** How many clans held a place at the board's last capture. */
  ranked: number | null;
  /** Places that win gold on this edition, on this server. */
  rewardPositions: number | null;
};

export type ClanManeuversPoint = { t: number; place: number; famePoints: number };

export type ClanManeuvers = {
  clanId: number;
  tag: string | null;
  latest: { eventName: string; startDate: string | null; endDate: string | null } | null;
  current:
    | (ClanManeuversEdition & {
        gain24h: number | null;
        placeChange24h: number | null;
      })
    | null;
  history: ClanManeuversPoint[];
  editions: ClanManeuversEdition[];
  /** The clan's players on the newest edition's player board, best first,
   * with the field they are ranked against. */
  members: ManeuversPlayerRow[];
  playersRanked: number | null;
  /** Places that win the vehicle on the newest edition. */
  vehiclePositions: number | null;
  /** The newest edition's bond shares, in percent (see `ManeuversEdition`). */
  accountBondsPercent: number | null;
  clanBondsPercent: number | null;
};

/**
 * A clan's Maneuvers record, read off our own capture of the boards: its
 * standing on each edition, its climb through the newest one, and which of its
 * players sit on the player board, which is the half an officer actually
 * steers by and that no screen in the game puts side by side.
 *
 * The clan resolves through the shared address lookup, like every clan
 * endpoint, so an ended clan's `TAG-<id>` page reads its own record. Null when
 * the address names no clan we know.
 */
export async function getClanManeuvers(
  region: Region,
  address: string,
): Promise<ClanManeuvers | null> {
  const clanId = await getClanIdByAddress(region, address);
  if (clanId == null) return null;

  const editions = maneuversEditionsByRegion[region];
  const entries = maneuversClansByRegion[region];
  const snapshots = maneuversSnapshotsByRegion[region];
  const clans = clansByRegion[region];

  const [held, rows, counts, [known]] = await Promise.all([
    db.select().from(editions).orderBy(sql`${editions.startDate} DESC NULLS LAST`),
    db
      .select({
        eventName: entries.eventName,
        place: entries.place,
        famePoints: entries.famePoints,
      })
      .from(entries)
      .where(eq(entries.clanId, clanId)),
    db
      .selectDistinctOn([snapshots.eventName], {
        eventName: snapshots.eventName,
        clanCount: snapshots.clanCount,
        playerCount: snapshots.playerCount,
      })
      .from(snapshots)
      .orderBy(snapshots.eventName, desc(snapshots.capturedAt)),
    db.select({ tag: clans.tag }).from(clans).where(eq(clans.id, clanId)).limit(1),
  ]);

  const byEvent = new Map(rows.map((r) => [r.eventName, r]));
  const fieldOf = new Map(counts.map((c) => [c.eventName, c]));
  const recorded: ClanManeuversEdition[] = held.flatMap((e) => {
    const row = byEvent.get(e.eventName);
    if (!row) return [];
    return [
      {
        eventName: e.eventName,
        startDate: e.startDate?.toISOString() ?? null,
        endDate: e.endDate?.toISOString() ?? null,
        place: row.place,
        famePoints: Number(row.famePoints),
        ranked: fieldOf.get(e.eventName)?.clanCount ?? null,
        rewardPositions: e.clanGoldPositions,
      },
    ];
  });

  const newest = held[0] ?? null;
  const onNewest = newest
    ? recorded.find((r) => r.eventName === newest.eventName) ?? null
    : null;

  // The whole board the leaderboard holds in memory gives both the clan's day
  // and its members' rows, so they are the figures the boards show.
  const [board, history] = newest
    ? await Promise.all([
        readManeuversBoard(region, newest.eventName),
        onNewest ? readClimb(region, newest.eventName, clanId) : [],
      ])
    : [null, []];
  const row = board?.clans.find((c) => c.clanId === clanId);

  return {
    clanId,
    tag: known?.tag ?? null,
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
    members: board?.players.filter((p) => p.clanId === clanId) ?? [],
    playersRanked: newest ? (fieldOf.get(newest.eventName)?.playerCount ?? null) : null,
    vehiclePositions: newest?.tankRewardPositions ?? null,
    accountBondsPercent: newest?.accountBondsPercent ?? null,
    clanBondsPercent: newest?.clanBondsPercent ?? null,
  };
}

/** Every recorded move of one clan through one edition, oldest first. */
async function readClimb(
  region: Region,
  eventName: string,
  clanId: number,
): Promise<ClanManeuversPoint[]> {
  const history = maneuversClanHistoryByRegion[region];
  const rows = await db
    .select({
      capturedAt: history.capturedAt,
      place: history.place,
      famePoints: history.famePoints,
    })
    .from(history)
    .where(and(eq(history.eventName, eventName), eq(history.clanId, clanId)))
    .orderBy(asc(history.capturedAt));
  return rows.map((r) => ({
    t: Math.floor(r.capturedAt.getTime() / 1000),
    place: r.place,
    famePoints: Number(r.famePoints),
  }));
}
