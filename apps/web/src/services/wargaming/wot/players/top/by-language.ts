import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion, playerRatingsByRegion, playersByRegion, type PlayerBadgeFlags } from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";

export type TopPlayerByLanguageResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wnx: number;
  languages: string[];
} & PlayerBadgeFlags;

// Lower than the global Overall leaderboard floor (20k) because the
// language-filtered pool is smaller — a 10k floor surfaces enough candidates
// per language for niche communities to produce a useful leaderboard. Matches
// the materialization pool floor in `players/top/ratings.ts`.
const MIN_BATTLES = 10000;

const VALID_METRIC_COLUMNS: Record<string, string> = {
  wn7: "wn7",
  wn8: "wn8",
  wnx: "wnx",
};

async function getTopPlayersGlobal(
  region: Region,
  col: string,
  limit: number,
): Promise<TopPlayerByLanguageResult[]> {
  // No language filter: just the top N by metric straight off the players
  // table (indexed, cheap) — no inference needed. Mirrors the "All" tab.
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);
  const rows = (await db.execute(sql`
    SELECT
      p.account_id, p.nickname, p.battles, ${metricCol} AS value,
      c.tag AS clan_tag, c.color AS clan_color
    FROM ${players} p
    LEFT JOIN ${clans} c ON c.id = p.clan_id
    WHERE ${metricCol} IS NOT NULL
      AND p.battles >= ${MIN_BATTLES}
      AND p.soft_deleted_at IS NULL
    ORDER BY ${metricCol} DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    account_id: number | string;
    nickname: string;
    battles: number;
    value: number | string;
    clan_tag: string | null;
    clan_color: string | null;
  }>;
  return rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    wnx: Number(r.value),
    languages: [],
  }));
}

/**
 * Region-scoped top players, optionally filtered by inferred language. With a
 * language filter this reads the materialized `player_ratings` table (refreshed
 * hourly by the top-players cron, which runs the top-candidates x clan-history
 * language inference once in the background), so the board is a cheap indexed
 * read on the GIN `languages` index instead of the ~5s two-phase CTE per
 * request. `strict` requires the inferred set to be exactly {language}. Without
 * a language it ranks straight off the players table (already indexed + cheap).
 */
export async function getTopPlayersByLanguage(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean = false,
): Promise<TopPlayerByLanguageResult[]> {
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) {
    throw new Error(`top-players by-language: unknown metric ${metric}`);
  }
  if (!language) return getTopPlayersGlobal(region, col, limit);

  const table = playerRatingsByRegion[region];
  const metricCol = sql.raw(`"${col}"`);
  // Strict mode: a player whose inferred set is exactly {language}.
  const langClause = strict
    ? sql`AND languages = ARRAY[${language}]::text[]`
    : sql`AND ${language} = ANY(languages)`;
  const rows = (await db.execute(sql`
    SELECT
      account_id, nickname, battles, ${metricCol} AS value,
      clan_tag, clan_color, languages
    FROM ${table}
    WHERE ${metricCol} IS NOT NULL
      AND battles >= ${MIN_BATTLES}
      ${langClause}
    ORDER BY ${metricCol} DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    account_id: number | string;
    nickname: string;
    battles: number;
    value: number | string;
    clan_tag: string | null;
    clan_color: string | null;
    languages: string[] | null;
  }>;
  return rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    wnx: Number(r.value),
    languages: r.languages ?? [],
  }));
}
