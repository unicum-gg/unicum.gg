import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/services/db";
import { clansByRegion } from "@/services/db/schema";
import { type Region } from "@/services/wargaming/wot";

export type AvailableLanguage = {
  code: string;
  clansCount: number;
};

// Lower than the global leaderboard floor: chips count what users will
// actually see on the filtered page, and filtered pages relax to 25 so
// minority languages produce real leaderboards. Must match
// `MIN_MEMBERS_BY_LANGUAGE` in `wargaming/wot/clans/top/by-language.ts`.
const MIN_MEMBERS = 25;

async function getAvailableLanguagesUncached(
  region: Region,
): Promise<AvailableLanguage[]> {
  const clans = clansByRegion[region];
  // Unnest the languages array and tally per code, restricted to clans
  // large enough to actually show up in the leaderboard (matches the
  // top-clans MIN_MEMBERS threshold).
  const rows = (await db.execute(sql`
    SELECT lang, COUNT(*)::int AS clans_count
    FROM (
      SELECT unnest(languages) AS lang
      FROM ${clans}
      WHERE members_count >= ${MIN_MEMBERS} AND is_disbanded = false
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
 * Languages declared by at least one large clan in the given region,
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
    SELECT
      COUNT(*) FILTER (WHERE ${language} = ANY(languages))::int AS total,
      COUNT(*) FILTER (WHERE languages = ARRAY[${language}]::text[])::int
        AS strict
    FROM ${clans}
    WHERE members_count >= ${MIN_MEMBERS} AND is_disbanded = false
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
 * many large clans declare this language (alongside others), and how many
 * declare ONLY this language. Same 25-member floor as the chips so the
 * numbers line up.
 */
export function getLanguageFilterCounts(
  region: Region,
  language: string,
): Promise<LanguageFilterCounts> {
  return getLanguageFilterCountsCached(region, language);
}
