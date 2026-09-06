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

  const result = await db.execute(sql`
    WITH placed AS (
      SELECT account_id, event_id, rank FROM ${sql.raw(ratings)}
      UNION ALL
      SELECT account_id, event_id, rank FROM ${sql.raw(history)}
    ),
    best AS (
      SELECT
        pl.account_id,
        MIN(pl.rank) AS best_rank,
        COUNT(DISTINCT pl.event_id) AS seasons,
        -- Legend is a POSITION, not a score, and the cutoff is the season's
        -- own: the top slice of a field that grows all season, so the same rank
        -- can be Legend in one season and not in another. Judged against the
        -- season it was held in, never against today's.
        BOOL_OR(
          s.elite_position IS NOT NULL AND pl.rank <= s.elite_position
        ) AS ever_legend
      FROM placed pl
      JOIN ${sql.raw(seasons)} s ON s.event_id = pl.event_id
      GROUP BY pl.account_id
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
