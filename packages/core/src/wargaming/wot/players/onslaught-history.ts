import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  onslaughtRatingHistoryByRegion,
  onslaughtRatingsByRegion,
  onslaughtSeasonSnapshotsByRegion,
  onslaughtSeasonsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import { mirrorCommitAt } from "./onslaught";

// Instants cross the wire as epoch seconds, like the server-population series:
// a number carries no timezone to be misread, and the client is the only place
// that knows the reader's own.
function epoch(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** The board as a whole at one instant. */
export type OnslaughtSeasonPoint = {
  t: number;
  /** Players holding a place on the board. */
  ranked: number;
  /** Points needed for Legend, Wargaming's own published threshold. */
  legendPoints: number | null;
  /** Points sitting at the Champion position, read off the board. */
  championPoints: number | null;
  topRating: number | null;
  /** The last ranked player's rating: the real price of entry. */
  minRating: number | null;
  /** Battles summed over every ranked player, the mode's activity. */
  battles: number | null;
};

/**
 * How a season's board moved, from the first pass that recorded it to the last.
 *
 * This answers the question the mode is actually about, and that the standings
 * alone cannot: not who is ranked, but what it currently costs to hold a rank,
 * and whether that price is rising. The source publishes only the present
 * instant and keeps no history, so these rows exist because we recorded them and
 * nowhere else.
 *
 * `eventId` picks a season; omitted, it is the most recent one.
 */
export async function getOnslaughtSeasonHistory(
  region: Region,
  eventId?: string,
): Promise<{ eventId: string; points: OnslaughtSeasonPoint[] } | null> {
  const seasons = onslaughtSeasonsByRegion[region];
  const snapshots = onslaughtSeasonSnapshotsByRegion[region];

  const [season] = eventId
    ? await db.select().from(seasons).where(eq(seasons.eventId, eventId)).limit(1)
    : // NULLS LAST: Postgres sorts DESC nulls first, so a dateless row would
      // otherwise win "the most recent season" and return its empty series.
      await db
        .select()
        .from(seasons)
        .orderBy(sql`${seasons.startDate} DESC NULLS LAST`)
        .limit(1);
  if (!season) return null;

  const rows = await db
    .select({
      capturedAt: snapshots.capturedAt,
      ranked: snapshots.rankedCount,
      legendPoints: snapshots.elitePoints,
      championPoints: snapshots.masterPoints,
      topRating: snapshots.topRating,
      minRating: snapshots.minRating,
      battles: snapshots.totalBattles,
    })
    .from(snapshots)
    .where(eq(snapshots.eventId, season.eventId))
    .orderBy(asc(snapshots.capturedAt));

  return {
    eventId: season.eventId,
    points: rows.map((r) => ({
      t: epoch(r.capturedAt),
      ranked: r.ranked,
      legendPoints: r.legendPoints,
      championPoints: r.championPoints,
      topRating: r.topRating,
      minRating: r.minRating,
      battles: r.battles,
    })),
  };
}

// How many samples of a player's own climb a profile ships. Enough to draw the
// shape of a season, bounded so an active player on a long season cannot turn a
// page view into an unbounded transfer.
const PLAYER_HISTORY_LIMIT = 500;

/** Where a player stood in one season, with that season's own thresholds. */
export type PlayerOnslaughtStanding = {
  eventId: string;
  codename: string | null;
  seasonOrdinal: string | null;
  /** Mirror ref pinning a past season's rank art to when it was live. */
  assetsRef: string | null;
  ended: boolean;
  startDate: string | null;
  endDate: string | null;
  rank: number;
  rating: number;
  battles: number;
  elitePosition: number | null;
  masterPosition: number | null;
};

/** One instant of a player's own climb. */
export type PlayerOnslaughtPoint = {
  t: number;
  rank: number;
  rating: number;
  battles: number;
};

/**
 * A player's Onslaught record: every season they ranked in, newest first, plus
 * their climb through the most recent of them.
 *
 * Only players who reach Champion ever appear on the board, so an empty record
 * is the common case and means "not ranked", never "no data". Resolved by
 * nickname because that is what a player page is keyed by, then carried by
 * account id, which is the only stable identity here.
 *
 * Returns null when the region does not know the nickname at all, which the
 * endpoint answers as a 404, the same way the other per-player reads do.
 */
export async function getPlayerOnslaught(
  region: Region,
  nickname: string,
): Promise<{
  accountId: number;
  nickname: string;
  standings: PlayerOnslaughtStanding[];
  history: PlayerOnslaughtPoint[];
  /** When the standings shown were last true, from the source's own
   * recomputation stamp rather than our clock, so a reader can tell a live
   * board from one that stopped moving. Unix seconds. */
  lastRecalculationTs: number | null;
} | null> {
  const players = playersByRegion[region];
  const ratings = onslaughtRatingsByRegion[region];
  const seasons = onslaughtSeasonsByRegion[region];
  const history = onslaughtRatingHistoryByRegion[region];

  // One round trip, driven from `players`, rather than resolving the nickname
  // first and then reading the standings: the same reason the clan history reads
  // this way, since one query is one connection out of a pool the busiest page
  // on the site is already competing for. The joins are LEFT, so an unranked
  // player still comes back as a single row and stays distinguishable from a
  // nickname this region has never heard of.
  const rows = await db
    .select({
      accountId: players.accountId,
      playerNickname: players.nickname,
      eventId: ratings.eventId,
      rank: ratings.rank,
      rating: ratings.rating,
      battles: ratings.battles,
      codename: seasons.codename,
      seasonOrdinal: seasons.seasonOrdinal,
      startDate: seasons.startDate,
      endDate: seasons.endDate,
      elitePosition: seasons.elitePosition,
      masterPosition: seasons.masterPosition,
      lastRecalculationTs: seasons.lastRecalculationTs,
    })
    .from(players)
    .leftJoin(ratings, eq(ratings.accountId, players.accountId))
    .leftJoin(seasons, eq(seasons.eventId, ratings.eventId))
    // Case-insensitive against `lower(nickname)`, which is what the index is on:
    // a plain equality seq-scans the players table.
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
    .orderBy(sql`${seasons.startDate} DESC NULLS LAST`);
  if (rows.length === 0) return null;

  const accountId = Number(rows[0].accountId);
  const playerNickname = rows[0].playerNickname;

  const now = Date.now();
  const standings = await Promise.all(
    rows
      .filter((r) => r.eventId != null)
      .map(async (r) => {
        const ended = r.endDate != null && r.endDate.getTime() < now;
        return {
          eventId: r.eventId!,
          codename: r.codename,
          seasonOrdinal: r.seasonOrdinal,
          // A finished season's rank art is pinned to the mirror as it stood
          // when it ended, since the client overwrites those files every year.
          assetsRef:
            ended && r.endDate != null
              ? await mirrorCommitAt(r.endDate.toISOString())
              : null,
          ended,
          startDate: r.startDate?.toISOString() ?? null,
          endDate: r.endDate?.toISOString() ?? null,
          rank: r.rank!,
          rating: r.rating!,
          battles: r.battles!,
          elitePosition: r.elitePosition,
          masterPosition: r.masterPosition,
        };
      }),
  );

  // The climb through the most recent season they ranked in, most recent samples
  // first and then reversed, so the series is bounded by construction. The
  // capture writes a row per player per instant they moved, so an active player
  // over a six week season runs to thousands: worth reading the tail of, never
  // worth shipping whole on a page view.
  const latest = standings[0];
  const points = latest
    ? await db
        .select({
          capturedAt: history.capturedAt,
          rank: history.rank,
          rating: history.rating,
          battles: history.battles,
        })
        .from(history)
        .where(
          and(
            eq(history.eventId, latest.eventId),
            eq(history.accountId, accountId),
          ),
        )
        .orderBy(desc(history.capturedAt))
        .limit(PLAYER_HISTORY_LIMIT)
    : [];
  points.reverse();

  return {
    accountId,
    nickname: playerNickname,
    lastRecalculationTs: rows[0]?.lastRecalculationTs ?? null,
    standings,
    history: points.map((p) => ({
      t: epoch(p.capturedAt),
      rank: p.rank,
      rating: p.rating,
      battles: p.battles,
    })),
  };
}
