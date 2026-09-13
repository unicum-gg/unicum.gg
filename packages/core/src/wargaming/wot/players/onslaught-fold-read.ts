import { sql } from "drizzle-orm";
import {
  clansByRegion,
  onslaughtDailyByRegion,
  onslaughtRatingHistoryByRegion,
  onslaughtRatingsByRegion,
  onslaughtSeasonSnapshotsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

/**
 * What the board and a player page read off the daily fold.
 *
 * The fold beside this (`onslaught-daily`) is the writer: it turns the captures
 * into one row per player per day. These are the four questions asked of those
 * rows, and they are apart from it because a read path and a cron path share
 * nothing but the table, and one file holding both had grown past the size
 * anyone reads in a sitting.
 */

/**
 * The accounts that were already ranked when we first looked at a season.
 *
 * What it costs to get onto the board is the battle count a player carried the
 * first time they appeared on it, and that reading only holds for a player we
 * saw arrive. For anyone already there when the capture began, the first row we
 * hold is a state, not an entry, and reporting it as one would understate them.
 *
 * They are cheap to name because the board fills up rather than starting full:
 * the current EU season had 51 players on it at our first pass, seventeen hours
 * in, out of the 930 entries we went on to observe. The first pass writes every
 * one of them (there is no prior state to difference against), so the cohort is
 * exactly the accounts holding a row at the season's earliest capture.
 *
 * That reasoning only holds while the first pass really did see the whole
 * board, which is checked rather than assumed: the season snapshot written by
 * the same pass carries the board's own `ranked_count`, and the two must agree.
 * A season we began capturing once the board was already populated fails the
 * check, and then EVERY first row is a state rather than an arrival, so no
 * entry cost is published for it at all. Publishing one would silently report a
 * mid-season battle count as the price of qualifying.
 */
export type OnslaughtEntryCohort = {
  /** Accounts whose first recorded row is a state, not an arrival. */
  rankedAtFirstCapture: Set<number>;
  /** False when the first capture did not see the whole board, in which case
   * the set is empty and no entry cost may be published for the season. */
  complete: boolean;
};

export async function getOnslaughtEntryCohort(
  region: Region,
  eventId: string,
): Promise<OnslaughtEntryCohort> {
  const history = onslaughtRatingHistoryByRegion[region];
  const snapshots = onslaughtSeasonSnapshotsByRegion[region];
  const rows = await db.execute<{ recorded: number; ranked: number | null }>(
    sql`WITH t0 AS (
          SELECT min(captured_at) AS at FROM ${history} WHERE event_id = ${eventId}
        )
        SELECT (SELECT count(*)::int FROM ${history} h, t0
                 WHERE h.event_id = ${eventId} AND h.captured_at = t0.at) AS recorded,
               (SELECT ranked_count FROM ${snapshots} s, t0
                 WHERE s.event_id = ${eventId} AND s.captured_at = t0.at) AS ranked`,
  );
  const recorded = rows[0]?.recorded ?? 0;
  const ranked = rows[0]?.ranked ?? null;
  // Complete iff the first pass recorded every player the board held at that
  // instant. It did on all three regions of the current season (51 of 51 on EU,
  // 7 of 7 on NA, 19 of 19 on Asia), because the board fills up over a season
  // rather than starting full and the first pass has no prior state to
  // difference against. A season we started capturing once the board was
  // already populated fails this, and then no arrival can be told from a state.
  const complete = ranked != null && recorded > 0 && recorded === ranked;

  if (!complete) return { rankedAtFirstCapture: new Set(), complete };

  const accounts = await db.execute<{ account_id: string | number }>(
    sql`SELECT account_id
        FROM ${history}
        WHERE event_id = ${eventId}
          AND captured_at = (
            SELECT min(captured_at) FROM ${history} WHERE event_id = ${eventId}
          )`,
  );
  return {
    rankedAtFirstCapture: new Set(accounts.map((r) => Number(r.account_id))),
    complete,
  };
}

/**
 * How hard a ranked player has been going at the season, per account.
 *
 * Rates are per day PLAYED, not per day of the season. A season counts everyone
 * from its first morning, so dividing by its length answers "how much of the
 * season did you spend playing" for someone who joined it late, which is a
 * different question and a worse one on a board that only ranked them once they
 * qualified. `activeDays` ships alongside so the denominator is never implied.
 */
export type OnslaughtRates = {
  /** Battles they had played the first time they appeared on the board: the
   * price of qualifying. Read off their first day rather than subtracted from
   * the season total, which the attribution limit would understate. Always
   * present, since holding a day at all means we saw them arrive. */
  entryBattles: number;
  /** Days this account was seen playing at all. */
  activeDays?: number;
  /** Battles observed since the account entered the board (gains only). */
  battles?: number;
  /** Rating won or lost over those same battles. Can be negative. */
  points?: number;
  battlesPerDay?: number;
  pointsPerDay?: number;
  /** What a battle has been worth to them, over the observed battles. */
  pointsPerBattle?: number;
  /** Last capture that moved, in unix seconds, which is what "still playing"
   * reads. Epoch seconds like the other series, so no timezone crosses the
   * wire to be misread. */
  lastActiveAt?: number;
};

type RateRow = {
  account_id: string | number;
  active_days: number;
  battles: number;
  points: number;
  last_at: Date | string | null;
  entry_battles: number | null;
};

/**
 * Every ranked account's rates for one season, in a single grouped read.
 *
 * One row per account per day played is a few tens of thousands of rows for a
 * whole season, so this is cheap enough to sit on the board's own read path
 * with no cache in front of it, which is the entire reason the fold exists.
 */
export async function getOnslaughtRates(
  region: Region,
  eventId: string,
): Promise<Map<number, OnslaughtRates>> {
  const daily = onslaughtDailyByRegion[region];
  const rows = await db.execute<RateRow>(
    sql`SELECT account_id,
               count(*) FILTER (WHERE battles > 0)::int AS active_days,
               coalesce(sum(battles), 0)::int AS battles,
               coalesce(sum(points), 0)::int AS points,
               max(last_at) FILTER (WHERE battles > 0) AS last_at,
               -- Their first day's totals less what that day is credited with:
               -- the first capture of a player has nothing before it, so it is
               -- never credited, and what is left is exactly the state they
               -- arrived in.
               (array_agg(battles_total - battles ORDER BY day ASC))[1]::int
                 AS entry_battles
        FROM ${daily}
        WHERE event_id = ${eventId}
        GROUP BY account_id`,
  );

  const out = new Map<number, OnslaughtRates>();
  for (const r of rows) {
    const entryBattles = r.entry_battles ?? 0;
    const activeDays = r.active_days;
    const battles = r.battles;
    const points = r.points;
    // A player can hold days here and no day of PLAY: everything we saw them
    // gain spanned a stretch too long to place. They still have an entry cost,
    // which is the sturdier of the two figures, so it is served on its own
    // rather than dropped with the rate. A rate of zero would read as "plays
    // and wins nothing" instead of "we have not watched them play".
    if (activeDays <= 0 || battles <= 0 || r.last_at == null) {
      out.set(Number(r.account_id), { entryBattles });
      continue;
    }
    out.set(Number(r.account_id), {
      entryBattles,
      activeDays,
      battles,
      points,
      battlesPerDay: battles / activeDays,
      pointsPerDay: points / activeDays,
      pointsPerBattle: points / battles,
      lastActiveAt: Math.floor(new Date(r.last_at).getTime() / 1000),
    });
  }
  return out;
}

/**
 * A player who held a place on the board this season and lost it.
 *
 * Our standings are the present tense: the feeder reads the board as it stands
 * and prunes everyone who has left it, so they can only be recovered from the
 * fold, which keeps the days it saw them ranked. On the current EU season that
 * is 205 accounts of the 998 that have ever held a place, a fifth of the field.
 */
export type OnslaughtDropout = {
  // snake_case on the identity, like every other API row, so `identityFromRow`
  // reads it and the crest resolver can decorate it in place.
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  /** The best position they reached before losing the place. */
  bestRank: number;
  /** Where they stood the last time we saw them on the board. */
  lastRank: number;
  lastRating: number;
  battles: number;
  /** Unix seconds of the last capture that still had them on the board. */
  lastSeenAt: number;
};

type DropoutRow = {
  account_id: string | number;
  nickname: string | null;
  clan_tag: string | null;
  clan_color: string | null;
  best_rank: number;
  last_rank: number;
  last_rating: number;
  battles: number;
  last_at: Date | string;
};

/**
 * Everyone who has lost their place this season, most recently first.
 *
 * Read off the fold rather than the captures: the same answer from the history
 * is a `DISTINCT ON` over ~170,000 rows per season, and this is a few thousand.
 * Their identity comes from the players table, since the standings row that
 * carried their recorded nickname is what the prune removed. An account we do
 * not track at all is skipped rather than shown as a number (three of the 205
 * on EU).
 */
export async function getOnslaughtDropouts(
  region: Region,
  eventId: string,
): Promise<OnslaughtDropout[]> {
  const daily = onslaughtDailyByRegion[region];
  const ratings = onslaughtRatingsByRegion[region];
  const players = playersByRegion[region];
  const clans = clansByRegion[region];

  const rows = await db.execute<DropoutRow>(
    sql`WITH last AS (
          SELECT DISTINCT ON (account_id)
                 account_id, rank_end, rating_total, battles_total, last_at
          FROM ${daily}
          WHERE event_id = ${eventId}
          ORDER BY account_id, day DESC
        ),
        best AS (
          SELECT account_id, min(best_rank)::int AS best_rank
          FROM ${daily} WHERE event_id = ${eventId} GROUP BY account_id
        )
        SELECT l.account_id,
               p.nickname,
               c.tag AS clan_tag,
               c.color AS clan_color,
               b.best_rank,
               l.rank_end AS last_rank,
               l.rating_total AS last_rating,
               l.battles_total AS battles,
               l.last_at
        FROM last l
        JOIN best b ON b.account_id = l.account_id
        JOIN ${players} p ON p.account_id = l.account_id
        LEFT JOIN ${clans} c ON c.id = p.clan_id
        WHERE NOT EXISTS (
          SELECT 1 FROM ${ratings} r
          WHERE r.event_id = ${eventId} AND r.account_id = l.account_id
        )
        ORDER BY l.last_at DESC`,
  );

  return rows
    .filter((r) => r.nickname != null)
    .map((r) => ({
      account_id: Number(r.account_id),
      nickname: r.nickname!,
      clan_tag: r.clan_tag,
      clan_color: r.clan_color,
      bestRank: r.best_rank,
      lastRank: r.last_rank,
      lastRating: r.last_rating,
      battles: r.battles,
      lastSeenAt: Math.floor(new Date(r.last_at).getTime() / 1000),
    }));
}

/** A place one account held in a season and no longer holds. */
export type OnslaughtLostPlace = {
  bestRank: number;
  lastRank: number;
  lastRating: number;
  battles: number;
  lastSeenAt: number;
};

/**
 * Every season this account was ranked in, from the fold rather than the
 * standings, keyed by season.
 *
 * The standings only carry the seasons they are ranked in NOW, so a profile
 * built from them alone is silent about a season the player reached the board
 * in and then fell out of. The caller keeps the entries it has no standing for.
 */
export async function getPlayerOnslaughtPlaces(
  region: Region,
  accountId: number,
): Promise<Map<string, OnslaughtLostPlace>> {
  const daily = onslaughtDailyByRegion[region];
  const rows = await db.execute<{
    event_id: string;
    best_rank: number;
    last_rank: number;
    last_rating: number;
    battles: number;
    last_at: Date | string;
  }>(
    sql`SELECT event_id,
               min(best_rank)::int AS best_rank,
               (array_agg(rank_end ORDER BY day DESC))[1]::int AS last_rank,
               (array_agg(rating_total ORDER BY day DESC))[1]::int AS last_rating,
               (array_agg(battles_total ORDER BY day DESC))[1]::int AS battles,
               max(last_at) AS last_at
        FROM ${daily}
        WHERE account_id = ${accountId}
        GROUP BY event_id`,
  );
  return new Map(
    rows.map((r) => [
      r.event_id,
      {
        bestRank: r.best_rank,
        lastRank: r.last_rank,
        lastRating: r.last_rating,
        battles: r.battles,
        lastSeenAt: Math.floor(new Date(r.last_at).getTime() / 1000),
      },
    ]),
  );
}
