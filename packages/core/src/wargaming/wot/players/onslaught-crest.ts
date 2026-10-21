import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

/**
 * Recompute the Onslaught place every account has held, onto the player row.
 *
 * What the crest claims is "has been ranked", not "is ranked", and those differ
 * by design: a rating can fall back under the entry bar, and the capture prunes
 * that player out of the standings table so the board cannot grow duplicate
 * ranks. Reading the crest off the standings alone would therefore take the
 * mark back off a player the moment they had a bad night, which is not what
 * being a Champion once means.
 *
 * So it reads BOTH tables and unions them. `_rating_history` holds every
 * instant a standing moved, which covers the live season down to the quarter
 * hour, and `_onslaught_ratings` holds the current state, which is the only
 * record of the seasons captured before the history table existed. Neither
 * alone is the whole truth.
 *
 * Each place is judged against the Legend cutoff of the instant it was held.
 * The cutoff is a position that grows all season (EU's last one opened around
 * 140 and closed at 507), so a rank of 200 in mid-September was Champion then
 * even though it would be Legend under the final bar. Judging the whole history
 * against the season row's elite_position, which is that final bar, crowned
 * 425 of EU's 1,306 Legends who never held the rank (szalonywpp, reported
 * 2026-10-21: 200th on 15 September with the cutoff at 143, 652nd at the end).
 * A history row is paired with the season snapshot of the same capture pass,
 * which writes both at the same `captured_at`; one with no snapshot counts
 * towards the best rank and never towards Legend, since falling back to the
 * final bar is the bug.
 *
 * Recomputed in full rather than incremented: the source is a few thousand rows
 * per region, so an honest recount costs nothing and cannot drift the way a
 * counter does. Rows are only written when a value actually changes, so a daily
 * pass over a settled archive writes nothing at all.
 */
export async function refreshOnslaughtCrests(region: Region): Promise<number> {
  const p = `${region}_players`;
  const ratings = `${region}_onslaught_ratings`;
  const history = `${region}_onslaught_rating_history`;
  const seasons = `${region}_onslaught_seasons`;
  const snapshots = `${region}_onslaught_season_snapshots`;

  const result = await db.execute(sql`
    WITH placed AS (
      -- The current state is judged against the season row's cutoff, which is
      -- the cutoff of that same instant: today's for the live season, the
      -- final one for a season that has ended.
      SELECT r.account_id, r.event_id, r.rank, s.elite_position AS cutoff
      FROM ${sql.raw(ratings)} r
      JOIN ${sql.raw(seasons)} s ON s.event_id = r.event_id
      UNION ALL
      SELECT h.account_id, h.event_id, h.rank, sn.elite_position AS cutoff
      FROM ${sql.raw(history)} h
      LEFT JOIN ${sql.raw(snapshots)} sn
        ON sn.event_id = h.event_id AND sn.captured_at = h.captured_at
    ),
    best AS (
      SELECT
        account_id,
        MIN(rank) AS best_rank,
        COUNT(DISTINCT event_id) AS seasons,
        -- Legend is a POSITION, not a score, and the cutoff moves: the top
        -- slice of a field that grows all season. Judged against the cutoff
        -- of the instant the place was held, never against a later one.
        BOOL_OR(cutoff IS NOT NULL AND rank <= cutoff) AS ever_legend
      FROM placed
      GROUP BY account_id
    )
    UPDATE ${sql.raw(p)} AS p
    SET
      onslaught_best_tier = CASE WHEN b.ever_legend THEN 'legend' ELSE 'champion' END,
      onslaught_best_rank = b.best_rank,
      onslaught_seasons = b.seasons
    FROM best b
    WHERE p.account_id = b.account_id
      AND (
        p.onslaught_best_tier IS DISTINCT FROM
          CASE WHEN b.ever_legend THEN 'legend' ELSE 'champion' END
        OR p.onslaught_best_rank IS DISTINCT FROM b.best_rank
        OR p.onslaught_seasons IS DISTINCT FROM b.seasons
      )
  `);
  return result.count ?? 0;
}
