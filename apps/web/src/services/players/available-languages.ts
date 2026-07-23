import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { playerRatingsByRegion } from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";

export type PlayerLanguageStats = {
  code: string;
  total: number;
  strict: number;
};

/**
 * Inferred languages of the materialized top-player pool in the given region,
 * with `total` (player has this language among their dominant set) and `strict`
 * (player's single dominant language). Reads the `player_ratings` table (the
 * exact population the by-language board ranks from, refreshed hourly by the
 * top-players cron), so chip counts and page results agree by construction —
 * no separate re-run of the ~5s inference CTE.
 */
export async function getPlayerLanguageStats(
  region: Region,
): Promise<PlayerLanguageStats[]> {
  const table = playerRatingsByRegion[region];
  const rows = (await db.execute(sql`
    SELECT
      lang AS code,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE array_length(languages, 1) = 1)::int AS strict
    FROM ${table}, unnest(languages) AS lang
    GROUP BY lang
    ORDER BY total DESC
  `)) as unknown as Array<{ code: string; total: number; strict: number }>;
  return rows.map((r) => ({
    code: r.code,
    total: r.total,
    strict: r.strict,
  }));
}
