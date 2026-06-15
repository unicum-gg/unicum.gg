import { sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/services/db";
import {
  clansByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@/services/db/schema";
import { type Region } from "@/services/wargaming/wot";

export type AvailableLanguage = {
  code: string;
  clansCount: number;
};

// Matches `MIN_MEMBERS_BY_LANGUAGE` in
// `wargaming/wot/clans/top/by-language.ts` and the equivalent guard in
// `wargaming/wot/clans/top/index.ts`. Counted here on RATED members
// (players with a non-null metric on the cached players row) so the
// chip + Any/Strict toggle counts line up with the leaderboard the user
// actually sees — declared `members_count` would over-count clans whose
// roster is mostly inactive alts.
const MIN_RATED_MEMBERS = 25;

/**
 * Shared CTE chain: distill `(clan_id)` for clans that have at least
 * MIN_RATED_MEMBERS members with a non-null cached WNX. Both queries
 * below feed off this, so they always agree with the leaderboard's
 * eligibility rules.
 */
function eligibleClansCte(region: Region): SQL {
  const playerSnapshots = playerSnapshotsByRegion[region];
  const players = playersByRegion[region];
  return sql`
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
    )
  `;
}

async function getAvailableLanguagesUncached(
  region: Region,
): Promise<AvailableLanguage[]> {
  const clans = clansByRegion[region];
  const rows = (await db.execute(sql`
    ${eligibleClansCte(region)}
    SELECT lang, COUNT(*)::int AS clans_count
    FROM (
      SELECT unnest(c.languages) AS lang
      FROM ${clans} c
      INNER JOIN eligible e ON e.clan_id = c.id
      WHERE c.is_disbanded = false
    ) x
    GROUP BY lang
    ORDER BY clans_count DESC
  `)) as unknown as Array<{ lang: string; clans_count: number }>;
  return rows.map((r) => ({ code: r.lang, clansCount: r.clans_count }));
}

const getAvailableLanguagesCached = unstable_cache(
  getAvailableLanguagesUncached,
  ["available-languages"],
  { revalidate: 3600, tags: ["top-clans"] },
);

/**
 * Languages declared by at least one eligible clan in the given region,
 * sorted by clan count. Renders the language filter chips. 1-hour cache,
 * languages drift slowly.
 */
export function getAvailableLanguages(
  region: Region,
): Promise<AvailableLanguage[]> {
  return getAvailableLanguagesCached(region);
}

export type LanguageFilterCounts = {
  total: number;
  strict: number;
};

async function getLanguageFilterCountsUncached(
  region: Region,
  language: string,
): Promise<LanguageFilterCounts> {
  const clans = clansByRegion[region];
  const rows = (await db.execute(sql`
    ${eligibleClansCte(region)}
    SELECT
      COUNT(*) FILTER (WHERE ${language} = ANY(c.languages))::int AS total,
      COUNT(*) FILTER (WHERE c.languages = ARRAY[${language}]::text[])::int
        AS strict
    FROM ${clans} c
    INNER JOIN eligible e ON e.clan_id = c.id
    WHERE c.is_disbanded = false
  `)) as unknown as Array<{ total: number; strict: number }>;
  return {
    total: rows[0]?.total ?? 0,
    strict: rows[0]?.strict ?? 0,
  };
}

const getLanguageFilterCountsCached = unstable_cache(
  getLanguageFilterCountsUncached,
  ["language-filter-counts"],
  { revalidate: 3600, tags: ["top-clans"] },
);

/**
 * Pair of counts for the "Any / Strict" toggle at a given language: how
 * many eligible clans declare this language (alongside others), and how
 * many declare ONLY this language. Same eligibility as the leaderboard.
 */
export function getLanguageFilterCounts(
  region: Region,
  language: string,
): Promise<LanguageFilterCounts> {
  return getLanguageFilterCountsCached(region, language);
}
