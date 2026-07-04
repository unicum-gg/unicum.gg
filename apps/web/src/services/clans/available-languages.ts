import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@unicum.gg/core/db/schema";
import { type Region } from "@unicum.gg/wargaming/region";

// Matches `MIN_MEMBERS_BY_LANGUAGE` in
// `wargaming/wot/clans/top/by-language.ts` and the equivalent guard in
// `wargaming/wot/clans/top/index.ts`. Counted on RATED members (players
// with a non-null cached WNX) so the chip + Any/Strict toggle counts
// line up with the leaderboard the user actually sees — declared
// `members_count` over-counts clans whose roster is mostly inactive alts.
const MIN_RATED_MEMBERS = 25;

export type LanguageStats = {
  code: string;
  total: number;
  strict: number;
};

async function getLanguageStatsUncached(
  region: Region,
): Promise<LanguageStats[]> {
  const clans = clansByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const players = playersByRegion[region];
  // Single query so chip (`total`) and toggle (`total`+`strict`) cannot
  // drift apart — splitting them across two `unstable_cache`s
  // previously let the caches refresh at different times and show
  // inconsistent numbers (e.g. chip 1300, toggle 1305).
  const rows = (await db.execute(sql`
    WITH latest_memberships AS (
      SELECT DISTINCT ON (ps.player_id)
        ps.player_id, ps.clan_id
      FROM ${playerSnapshots} ps
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    ),
    eligible AS (
      SELECT lm.clan_id
      FROM latest_memberships lm
      INNER JOIN ${players} p ON p.id = lm.player_id
      GROUP BY lm.clan_id
      HAVING COUNT(p.wnx) >= ${MIN_RATED_MEMBERS}
    ),
    expanded AS (
      SELECT c.id, c.languages, unnest(c.languages) AS lang
      FROM ${clans} c
      INNER JOIN eligible e ON e.clan_id = c.id
      WHERE c.is_disbanded = false
    )
    SELECT
      lang,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE array_length(languages, 1) = 1)::int AS strict
    FROM expanded
    GROUP BY lang
    ORDER BY total DESC
  `)) as unknown as Array<{ lang: string; total: number; strict: number }>;
  return rows.map((r) => ({
    code: r.lang,
    total: r.total,
    strict: r.strict,
  }));
}

const getLanguageStatsCached = unstable_cache(
  getLanguageStatsUncached,
  ["language-stats"],
  { revalidate: 3600, tags: ["top-clans"] },
);

/**
 * Languages declared by eligible clans in the given region, sorted by
 * clan count, with `total` (clan has this language alongside others)
 * and `strict` (clan declared ONLY this language) per row. One shared
 * 1-hour cache feeds both the chips and the Any/Strict toggle so they
 * never disagree.
 */
export function getLanguageStats(region: Region): Promise<LanguageStats[]> {
  return getLanguageStatsCached(region);
}
