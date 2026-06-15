import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/services/db";
import {
  clansByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
} from "@/services/db/schema";
import { type Region } from "@/services/wargaming/wot";
import { VALID_METRIC_COLUMNS } from ".";

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
};

// Higher floor on the global leaderboard so the headline list reads as
// elite-only, but languages with a small footprint (Albanian, Tajik, etc.)
// would never produce a leaderboard at 50, so we drop to 25 once a
// language filter is applied. Matches the threshold used by
// `getAvailableLanguages` so the chip count and the filtered page agree.
const MIN_MEMBERS_GLOBAL = 50;
const MIN_MEMBERS_BY_LANGUAGE = 25;

async function getTopClansByLanguageUncached(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean,
): Promise<TopClanByLanguageResult[]> {
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) throw new Error(`top-clans by-language: unknown metric ${metric}`);
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const clans = clansByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);
  // Battle-weighted average to match the in-app computeMetrics in
  // components/clans/header. Language filter applied at the clan-join stage
  // so we don't waste compute averaging across clans we'll discard.
  // Strict mode: clan declared ONLY this language (`languages = ['de']`),
  // not `['de', 'en']`. Falls back to ANY when no language filter is set.
  const langClause = language
    ? strict
      ? sql`AND c.languages = ARRAY[${language}]::text[]`
      : sql`AND ${language} = ANY(c.languages)`
    : sql``;
  const minMembers = language ? MIN_MEMBERS_BY_LANGUAGE : MIN_MEMBERS_GLOBAL;
  const rows = (await db.execute(sql`
    WITH latest_memberships AS (
      SELECT DISTINCT ON (ps.player_id)
        ps.player_id,
        ps.clan_id,
        ps.battles
      FROM ${playerSnapshots} ps
      WHERE ps.clan_id IS NOT NULL
      ORDER BY ps.player_id, ps.taken_at DESC, ps.id DESC
    ),
    clan_stats AS (
      SELECT
        lm.clan_id,
        COUNT(*)::int AS members_in_db,
        COUNT(${metricCol})::int AS rated_members_count,
        (
          SUM(${metricCol} * lm.battles)
            FILTER (WHERE ${metricCol} IS NOT NULL AND lm.battles > 0)
          / NULLIF(
              SUM(lm.battles)
                FILTER (WHERE ${metricCol} IS NOT NULL AND lm.battles > 0),
              0
            )
        )::float8 AS avg_value
      FROM latest_memberships lm
      INNER JOIN ${players} p ON p.id = lm.player_id
      GROUP BY lm.clan_id
      HAVING COUNT(${metricCol}) > 0
    )
    SELECT
      c.id::text AS clan_id,
      c.tag,
      c.name,
      c.color,
      c.emblem,
      c.languages,
      c.members_count,
      cs.rated_members_count,
      cs.avg_value
    FROM clan_stats cs
    INNER JOIN ${clans} c ON c.id = cs.clan_id
    WHERE c.is_disbanded = false
      AND c.members_count >= ${minMembers}
      -- Also require a real rated population (matches global query).
      -- Stops troll/dormant clans (e.g. DRAKS, the Dragon Ball-themed
      -- meme clan with 94 declared members but ~14 active alts) from
      -- ranking with absurd battle-weighted averages from a handful
      -- of 1-3 battle accounts.
      AND cs.rated_members_count >= ${minMembers}
    ${langClause}
    ORDER BY cs.avg_value DESC NULLS LAST
    LIMIT ${limit}
  `)) as unknown as Array<{
    clan_id: string;
    tag: string;
    name: string;
    color: string;
    emblem: string | null;
    languages: string[];
    members_count: number;
    rated_members_count: number;
    avg_value: number;
  }>;
  return rows.map((r) => ({
    clan_id: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages,
    members_count: r.members_count,
    rated_members_count: r.rated_members_count,
    avg_value: Number(r.avg_value),
  }));
}

const getTopClansByLanguageCached = unstable_cache(
  getTopClansByLanguageUncached,
  ["top-clans-by-language"],
  { revalidate: 600, tags: ["top-clans"] },
);

/**
 * Region-scoped top clans, optionally filtered by language code. 10-minute
 * cache: the underlying DISTINCT ON over the snapshots table is heavy and
 * a leaderboard tolerates that staleness. `strict` requires the clan to
 * declare ONLY that single language; ignored when `language` is null.
 */
export function getTopClansByLanguage(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean = false,
): Promise<TopClanByLanguageResult[]> {
  return getTopClansByLanguageCached(region, metric, language, limit, strict);
}
