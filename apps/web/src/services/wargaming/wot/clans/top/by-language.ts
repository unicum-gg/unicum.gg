import { sql } from "drizzle-orm";
import { type ClanRankBadge, clanRatingsByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import { VALID_METRIC_COLUMNS } from "@unicum.gg/core/wargaming/wot/clans/top";

export type TopClanByLanguageResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  languages: string[];
  members_count: number;
  rated_members_count: number;
  avg_value: number;
  /** Podium positions, attached by the route (see `TopClanResult`). */
  badges?: ClanRankBadge[];
};

// Higher floor on the global leaderboard so the headline list reads as
// elite-only, but languages with a small footprint (Albanian, Tajik, etc.)
// would never produce a leaderboard at 50, so we drop to 25 once a
// language filter is applied. Matches the threshold used by
// `getAvailableLanguages` so the chip count and the filtered page agree.
const MIN_MEMBERS_GLOBAL = 50;
const MIN_MEMBERS_BY_LANGUAGE = 25;

/**
 * Region-scoped top clans, optionally filtered by language code. Reads the
 * materialized `clan_ratings` table (refreshed hourly by the top-clans cron
 * from the clan_members x players battle-weighted aggregate) as a cheap indexed
 * scan — ordered by `avg_value` on the `(metric, avg_value DESC)` index and
 * filtered on `languages`. No per-request aggregation and no cache: the ~8s
 * scan is paid once in the background, every language slice is served from the
 * same table. `strict` requires the clan to declare ONLY that single language;
 * ignored when `language` is null.
 */
export async function getTopClansByLanguage(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean = false,
): Promise<TopClanByLanguageResult[]> {
  if (!VALID_METRIC_COLUMNS[metric]) {
    throw new Error(`top-clans by-language: unknown metric ${metric}`);
  }
  const table = clanRatingsByRegion[region];
  // Strict mode: clan declared ONLY this language (`languages = ['de']`), not
  // `['de', 'en']`. Falls back to ANY when no language filter is set.
  const langClause = language
    ? strict
      ? sql`AND languages = ARRAY[${language}]::text[]`
      : sql`AND ${language} = ANY(languages)`
    : sql``;
  const minMembers = language ? MIN_MEMBERS_BY_LANGUAGE : MIN_MEMBERS_GLOBAL;
  const rows = (await db.execute(sql`
    SELECT
      clan_id, tag, name, color, emblem, languages,
      members_count, rated_members_count, avg_value
    FROM ${table}
    WHERE metric = ${metric}
      AND members_count >= ${minMembers}
      AND rated_members_count >= ${minMembers}
      ${langClause}
    ORDER BY avg_value DESC NULLS LAST
    LIMIT ${limit}
  `)) as unknown as Array<{
    clan_id: string | number;
    tag: string;
    name: string;
    color: string;
    emblem: string | null;
    languages: string[] | null;
    members_count: number;
    rated_members_count: number;
    avg_value: number | string;
  }>;
  return rows.map((r) => ({
    clan_id: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages ?? [],
    members_count: r.members_count,
    rated_members_count: r.rated_members_count,
    avg_value: Number(r.avg_value),
  }));
}
