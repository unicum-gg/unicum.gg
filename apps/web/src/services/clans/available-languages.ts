import { sql } from "drizzle-orm";
import { clanRatingsByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

// Matches `MIN_MEMBERS_BY_LANGUAGE` in
// `wargaming/wot/clans/top/by-language.ts`. Counted on RATED members (players
// with a non-null cached WNX) so the chip + Any/Strict toggle counts line up
// with the leaderboard the user actually sees.
const MIN_RATED_MEMBERS = 25;

export type LanguageStats = {
  code: string;
  total: number;
  strict: number;
};

/**
 * Languages declared by eligible clans in the given region, sorted by clan
 * count, with `total` (clan has this language alongside others) and `strict`
 * (clan declared ONLY this language) per row. Reads the materialized
 * `clan_ratings` table (WNX rows = the same rated gate the board applies), so
 * the chips share the board's exact clan set — same table, same membership
 * source, same 25-rated floor — instead of re-running a DISTINCT-ON scan over
 * player_snapshots. Refreshed hourly with the table by the top-clans cron.
 */
export async function getLanguageStats(
  region: Region,
): Promise<LanguageStats[]> {
  const table = clanRatingsByRegion[region];
  const rows = (await db.execute(sql`
    WITH eligible AS (
      SELECT clan_id, languages
      FROM ${table}
      WHERE metric = 'wnx'
        AND rated_members_count >= ${MIN_RATED_MEMBERS}
        AND members_count >= ${MIN_RATED_MEMBERS}
    )
    SELECT
      lang,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE array_length(languages, 1) = 1)::int AS strict
    FROM eligible, unnest(languages) AS lang
    GROUP BY lang
    ORDER BY total DESC
  `)) as unknown as Array<{ lang: string; total: number; strict: number }>;
  return rows.map((r) => ({
    code: r.lang,
    total: r.total,
    strict: r.strict,
  }));
}
