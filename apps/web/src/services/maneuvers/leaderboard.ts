import { asc, desc, eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  maneuversEditionHistory,
  maneuversClansByRegion,
  maneuversEditionsByRegion,
  maneuversPlayersByRegion,
  maneuversSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { type Baseline, readGains } from "@/services/maneuvers/gains";

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
 * Everything here is returned JSON-ready (ISO strings, no `Date`), which is
 * what the endpoint serves anyway.
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
  /** Share of the personal board that earns bonds, in percent. */
  accountBondsPercent: number | null;
  /** Share of the clan board whose members get a bond multiplier above one. */
  clanBondsPercent: number | null;
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
  /** The clan's brand colour, from our own clan table when we know the clan, so
   * the tag reads in the clan's colour like it does on every other board. Null
   * for a clan we have never seen. */
  clanColor: string | null;
  famePoints: number;
  /** Fame Points gained over the last 24 hours, null until the edition's
   * captures reach back a day. */
  gain24h: number | null;
  /** Places climbed over the last 24 hours (negative when it fell), null when
   * it held no place a day ago or the captures do not reach back that far. */
  placeChange24h: number | null;
  victories: number;
  defeats: number;
};

export type ManeuversClanRow = {
  place: number;
  clanId: number;
  tag: string | null;
  name: string | null;
  /** Brand colour and emblem, from our own clan table, so the row wears the
   * crest and colour the rest of the site gives the clan. Null/empty for a clan
   * we have never seen. */
  color: string | null;
  emblem: string | null;
  famePoints: number;
  gain24h: number | null;
  placeChange24h: number | null;
  victories: number;
  defeats: number;
};

/** One entry of the edition picker: every edition the event has run, and
 * whether we recorded its standings. */
export type ManeuversEditionRef = {
  eventName: string;
  available: boolean;
};

export type ManeuversBoard = {
  editions: ManeuversEditionRef[];
  edition: ManeuversEdition | null;
  standing: ManeuversStanding | null;
  players: ManeuversPlayerRow[];
  clans: ManeuversClanRow[];
};

/**
 * One edition's two boards read whole, every ranked row with its day's move.
 *
 * Whole because a board is ordered and searched across all of it: sorting on
 * the 24h gain or finding a nickname on page 140 cannot be answered from one
 * page. The read is a few indexed scans of the edition's rows plus one probe
 * per row for its baseline, ~100ms for EU's 15,000 players, so it is done once
 * a minute per edition and every request pages through the result.
 */
async function readBoard(
  region: Region,
  eventName: string | null,
): Promise<ManeuversBoard> {
  const editions = maneuversEditionsByRegion[region];

  // Every edition we hold, newest first. The newest is the one being played, or
  // the last one that was: an edition that has ended keeps its rows, so the
  // page shows a final table rather than an empty one once an edition closes.
  const held = await db
    .select()
    .from(editions)
    .orderBy(desc(editions.startDate));
  const editionRefs = maneuversEditionHistory(held.map((e) => e.eventName));
  const edition = eventName
    ? held.find((e) => e.eventName === eventName)
    : held[0];

  if (!edition) {
    return {
      editions: editionRefs,
      edition: null,
      standing: null,
      players: [],
      clans: [],
    };
  }

  const snapshots = maneuversSnapshotsByRegion[region];
  const players = maneuversPlayersByRegion[region];
  const maneuversClans = maneuversClansByRegion[region];
  // Our own clan table, joined for the brand colour and emblem the board rows
  // wear. The board only stores the tag and name it saw, so a clan's colour has
  // to come from here; a clan we have never crawled simply joins to nulls and
  // the row falls back to a bare tag, like any board does for an unknown clan.
  const clanTable = clansByRegion[region];

  const [[snapshot], playerRows, clanRows] = await Promise.all([
    db
      .select()
      .from(snapshots)
      .where(eq(snapshots.eventName, edition.eventName))
      .orderBy(desc(snapshots.capturedAt))
      .limit(1),
    db
      .select({
        place: players.place,
        accountId: players.accountId,
        nickname: players.nickname,
        clanId: players.clanId,
        clanTag: players.clanTag,
        clanColor: clanTable.color,
        famePoints: players.famePoints,
        victories: players.victories,
        defeats: players.defeats,
      })
      .from(players)
      .leftJoin(clanTable, eq(clanTable.id, players.clanId))
      .where(eq(players.eventName, edition.eventName))
      .orderBy(asc(players.place)),
    db
      .select({
        place: maneuversClans.place,
        clanId: maneuversClans.clanId,
        storedTag: maneuversClans.tag,
        storedName: maneuversClans.name,
        knownTag: clanTable.tag,
        knownName: clanTable.name,
        color: clanTable.color,
        emblem: clanTable.emblem,
        famePoints: maneuversClans.famePoints,
        victories: maneuversClans.victories,
        defeats: maneuversClans.defeats,
      })
      .from(maneuversClans)
      .leftJoin(clanTable, eq(clanTable.id, maneuversClans.clanId))
      .where(eq(maneuversClans.eventName, edition.eventName))
      .orderBy(asc(maneuversClans.place)),
  ]);

  const gains = await readGains(
    region,
    edition.eventName,
    playerRows.map((r) => r.accountId),
    clanRows.map((r) => r.clanId),
  );
  // An id with no capture at the baseline was not on the board yet, so it
  // gained everything it holds and has no earlier place to move from.
  const gain = (map: Map<number, Baseline> | undefined, id: number, points: number) =>
    map ? points - (map.get(id)?.famePoints ?? 0) : null;
  const move = (map: Map<number, Baseline> | undefined, id: number, place: number) => {
    const before = map?.get(id);
    return before ? before.place - place : null;
  };

  return {
    editions: editionRefs,
    edition: {
      eventName: edition.eventName,
      startDate: edition.startDate?.toISOString() ?? null,
      endDate: edition.endDate?.toISOString() ?? null,
      vehicleLevels: edition.vehicleLevels ?? [],
      tankRewardPositions: edition.tankRewardPositions,
      clanGoldPositions: edition.clanGoldPositions,
      accountBondsPercent: edition.accountBondsPercent,
      clanBondsPercent: edition.clanBondsPercent,
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
      clanColor: row.clanColor,
      famePoints: row.famePoints,
      gain24h: gain(gains?.players, row.accountId, row.famePoints),
      placeChange24h: move(gains?.players, row.accountId, row.place),
      victories: row.victories,
      defeats: row.defeats,
    })),
    clans: clanRows.map((row) => ({
      place: row.place,
      clanId: row.clanId,
      // Our own clan record is authoritative when we have it (the board stores
      // whatever tag/name it saw at capture, which can lag a rename); the
      // stored value is the fallback for a clan we have never crawled.
      tag: row.knownTag ?? row.storedTag,
      name: row.knownName ?? row.storedName,
      color: row.color,
      emblem: row.emblem,
      famePoints: row.famePoints,
      gain24h: gain(gains?.clans, row.clanId, row.famePoints),
      placeChange24h: move(gains?.clans, row.clanId, row.place),
      victories: row.victories,
      defeats: row.defeats,
    })),
  };
}

/** How long a whole board is held: the feeder captures every five minutes,
 * so a minute is fresh to within a fraction of a pass. */
const BOARD_TTL_MS = 60 * 1000;

const boards = new Map<string, { data: ManeuversBoard; expiresAt: number }>();
const inFlight = new Map<string, Promise<ManeuversBoard>>();

/**
 * One edition's boards whole, the newest when `eventName` is null, held in
 * the process rather than in `unstable_cache`: the whole board is a couple of
 * megabytes of JSON, which the shared Redis behind the data cache (2 GiB,
 * `allkeys-lru`, shared with the ISR pages) would evict pages to hold, and a
 * process recomputing it once a minute costs ~100ms. Concurrent misses share
 * one read.
 */
export function readManeuversBoard(
  region: Region,
  eventName: string | null = null,
): Promise<ManeuversBoard> {
  const key = `${region}:${eventName ?? ""}`;
  const hit = boards.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = readBoard(region, eventName)
    .then((data) => {
      boards.set(key, { data, expiresAt: Date.now() + BOARD_TTL_MS });
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
