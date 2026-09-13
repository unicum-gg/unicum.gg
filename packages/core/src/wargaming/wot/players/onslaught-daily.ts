import { eq, sql } from "drizzle-orm";
import {
  onslaughtDailyByRegion,
  onslaughtRatingHistoryByRegion,
  onslaughtSeasonsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Folding the Onslaught captures into a day.
 *
 * The mode publishes cumulative figures only: a rank, a points total, a battle
 * count, for the present instant. How fast someone is climbing, how many
 * battles a day that costs and what a battle is worth to them exist nowhere
 * upstream, and are recoverable only by differencing the captures we keep. That
 * is a real archive (about 170,000 rows for one EU season) and differencing it
 * per read grows with the season, on a board that is prerendered per locale, so
 * it is folded here once per day instead.
 *
 * Everything written is a GAIN between two captures, never a total. A player
 * appears on the board already carrying whatever they played to qualify, and
 * that entry value belongs to no day: the leader of the current EU season was
 * first seen holding 58 battles and 2,353 points. Leaving it out is what makes
 * the rate honest, and it means a season's days do not sum to its totals.
 */

/** How many UTC days a routine pass recomputes. */
const REBUILD_DAYS = 3;

/**
 * The longest gap between two captures that a day may still be credited for.
 *
 * A capture says a player's counter moved since the previous one, not when. For
 * two captures a quarter of an hour apart that distinction does not exist, and
 * across the mode's overnight closure (nine hours, and up to a full day for
 * someone who plays each evening) the battles still happened in the day they
 * were seen in. Past a day it stops being true, and in one specific way: the
 * board holds a few hundred places, so a player pushed off it keeps playing
 * where we cannot see them, and comes back with everything they did in between.
 * Crediting that to the day they reappeared would report 212 battles in a day
 * and count one day of play for a week of it.
 *
 * So a gain spanning more than a day is not placed anywhere. It stays in the
 * player's totals, which are the source's own, and it is absent from the rates,
 * which only ever claim the play we watched.
 *
 * The obvious objection is that this also drops the first session of anyone who
 * simply took two days off, and it is worth saying why it does not. A row is
 * written whenever rank, rating OR battles move, and the source reranks a board
 * of several hundred every five minutes, so a player who is ON it keeps
 * producing rows while idle. A gap of more than a day therefore means they were
 * not on the board, not that they were resting. The measurement agrees: of the
 * 229 captures this drops on the current EU season, 181 carry more than thirty
 * battles (20,859 of the 21,580), which no single sitting holds. Thirteen
 * captures and ninety battles of 152,320 are genuine session starts, and that
 * is the whole price.
 */
const MAX_ATTRIBUTABLE_GAP_HOURS = 24;

/**
 * How far back a partial rebuild reads for its baseline.
 *
 * The first capture of a day has to difference against the last capture of the
 * previous one, so the window has to reach past the longest gap a day can still
 * be credited for. Anything older than that is unattributable by the rule above
 * and would be dropped even if the window did reach it, which is what makes a
 * rebuild of the last few days agree exactly with a rebuild of the whole season
 * rather than quietly losing whatever fell outside.
 */
const BASELINE_LOOKBACK_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the day an instant falls in. */
function utcDay(at: Date): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}

/** `YYYY-MM-DD`, which is what a `date` column compares against. */
function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Rebuild one season's daily rows, from `fromDay` (UTC midnight) or in full.
 *
 * The range is deleted and rewritten rather than merged, so a rebuild is
 * idempotent and a change to what counts as a day's activity takes effect by
 * re-running it. In one transaction: the board reads this table, and a window
 * where a season has lost yesterday and not yet regained it would render as
 * everyone having stopped playing.
 *
 * A day older than the range never moves. The captures are append-only and
 * arrive stamped with the present, so yesterday is finished the moment it ends.
 */
export async function rebuildOnslaughtDaily(
  region: Region,
  eventId: string,
  fromDay: Date | null,
): Promise<number> {
  const history = onslaughtRatingHistoryByRegion[region];
  const daily = onslaughtDailyByRegion[region];

  // The baseline reaches back before the range so the first capture of the
  // first day differences against the previous day's last, instead of being
  // dropped for having nothing before it.
  const windowStart =
    fromDay == null
      ? null
      : new Date(fromDay.getTime() - BASELINE_LOOKBACK_DAYS * DAY_MS);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`DELETE FROM ${daily}
          WHERE event_id = ${eventId}
            ${fromDay == null ? sql`` : sql`AND day >= ${dayKey(fromDay)}::date`}`,
    );

    // `battles > prev_battles` is the definition of activity, and it also
    // decides where the points go: rating only moves in battle, so a capture
    // that carries points and no battle is the source recomputing rather than
    // someone playing.
    //
    // A day exists here as soon as the player was seen at all that day, even
    // when every gain of it was unattributable, because the cumulative totals
    // it carries are what the next day differences against and what the entry
    // cost is read from. Its `battles` is then zero, and the reader skips it as
    // a day played.
    const written = await tx.execute(
      sql`INSERT INTO ${daily} (event_id, account_id, day, battles, points, samples, last_at, battles_total, rating_total, best_rank, rank_end)
          WITH src AS (
            SELECT account_id,
                   captured_at,
                   battles,
                   rating,
                   rank,
                   lag(battles) OVER w AS prev_battles,
                   lag(rating) OVER w AS prev_rating,
                   captured_at - lag(captured_at) OVER w AS gap
            FROM ${history}
            WHERE event_id = ${eventId}
              ${windowStart == null ? sql`` : sql`AND captured_at >= ${windowStart.toISOString()}::timestamptz`}
            WINDOW w AS (PARTITION BY account_id ORDER BY captured_at)
          ),
          placed AS (
            SELECT account_id,
                   captured_at,
                   battles,
                   rating,
                   rank,
                   (
                     prev_battles IS NOT NULL
                     AND battles > prev_battles
                     AND gap <= ${`${MAX_ATTRIBUTABLE_GAP_HOURS} hours`}::interval
                   ) AS counts,
                   battles - prev_battles AS gained_battles,
                   rating - prev_rating AS gained_rating
            FROM src
            WHERE TRUE
              ${fromDay == null ? sql`` : sql`AND captured_at >= ${fromDay.toISOString()}::timestamptz`}
          )
          SELECT ${eventId},
                 account_id,
                 (captured_at AT TIME ZONE 'UTC')::date AS day,
                 coalesce(sum(gained_battles) FILTER (WHERE counts), 0)::int,
                 coalesce(sum(gained_rating) FILTER (WHERE counts), 0)::int,
                 count(*) FILTER (WHERE counts)::int,
                 coalesce(max(captured_at) FILTER (WHERE counts), max(captured_at)),
                 (array_agg(battles ORDER BY captured_at DESC))[1]::int,
                 (array_agg(rating ORDER BY captured_at DESC))[1]::int,
                 min(rank)::int,
                 (array_agg(rank ORDER BY captured_at DESC))[1]::int
          FROM placed
          GROUP BY account_id, (captured_at AT TIME ZONE 'UTC')::date`,
    );

    // The driver's own affected-row count. `RETURNING` would hand back one JS
    // object per written day, tens of thousands of them on a full rebuild,
    // serialized and allocated so that a length could be read off them.
    return written.count ?? 0;
  });
}

/**
 * The seasons this region holds captures for, oldest first.
 *
 * Not the same as the seasons it holds standings for: a season that ended
 * before the feeder existed has a final board and no climb behind it, so there
 * is nothing to fold and a rebuild that walked the standings instead would
 * write an empty season and report that it had done the work.
 */
export async function listOnslaughtCapturedSeasons(
  region: Region,
): Promise<string[]> {
  const history = onslaughtRatingHistoryByRegion[region];
  const rows = await db.execute<{ event_id: string }>(
    sql`SELECT DISTINCT event_id FROM ${history} ORDER BY event_id`,
  );
  return rows.map((r) => r.event_id);
}

/**
 * Keep the current season's daily rows in step with the captures.
 *
 * Three things decide the range, and each of them was a way to lose days
 * silently.
 *
 * The season is the newest one that has STARTED, not the newest row: the feeder
 * writes a season from the event definition, which can be published before it
 * is played, and a dated announcement would otherwise capture this job. It
 * would fold a season with no captures, rebuild it in full on every tick, and
 * stop refreshing the season actually being played, until someone noticed the
 * rates had stopped moving.
 *
 * The range reaches back to the last day we hold rather than a fixed few, so a
 * pass that has not run for a week rebuilds the week. A fixed window heals
 * nothing: the days behind it are never inserted and never attempted again, and
 * the only sign is a rate that quietly under-reports for the rest of the season.
 *
 * And the whole season is rebuilt when we hold no day of it at all, which
 * covers both a season that has just started and this table arriving on an
 * archive that predates it, without either needing a command of its own.
 */
export async function refreshOnslaughtDaily(
  region: Region,
): Promise<{ eventId: string; rows: number; full: boolean } | null> {
  const seasons = onslaughtSeasonsByRegion[region];
  const history = onslaughtRatingHistoryByRegion[region];
  const daily = onslaughtDailyByRegion[region];

  // NULLS LAST is not enough on its own here, which is the point: a dateless
  // row cannot be the running season and neither can one that starts tomorrow.
  const [season] = await db
    .select({ eventId: seasons.eventId })
    .from(seasons)
    .where(
      sql`${seasons.startDate} IS NOT NULL AND ${seasons.startDate} <= now()`,
    )
    .orderBy(sql`${seasons.startDate} DESC`)
    .limit(1);
  if (!season) return null;

  // Nothing captured yet is not an empty season to rebuild, it is a season
  // there is nothing to fold for. Without this the pass between a season row
  // being written and its first capture landing runs a season-wide delete and
  // insert every tick, and announces each one.
  const [captured] = await db
    .select({ one: sql<number>`1` })
    .from(history)
    .where(eq(history.eventId, season.eventId))
    .limit(1);
  if (captured == null) return null;

  const [held] = await db
    .select({ lastDay: sql<string | null>`max(${daily.day})` })
    .from(daily)
    .where(eq(daily.eventId, season.eventId));
  const lastHeld = held?.lastDay ?? null;
  const full = lastHeld == null;

  const routine = new Date(
    utcDay(new Date()).getTime() - (REBUILD_DAYS - 1) * DAY_MS,
  );
  const heldDay = lastHeld == null ? null : new Date(`${lastHeld}T00:00:00Z`);
  // The last day we hold is rebuilt too, not skipped: it was written while it
  // was still running, so it is the one day of the range that is certainly
  // incomplete.
  const from = heldDay == null ? null : heldDay < routine ? heldDay : routine;

  const rows = await rebuildOnslaughtDaily(region, season.eventId, from);
  return { eventId: season.eventId, rows, full };
}
