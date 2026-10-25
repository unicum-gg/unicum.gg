import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { RatingMetric, clansByRegion, playerRatingsByRegion, playersByRegion, type PlayerBadgeFlags } from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";
import {
  recentBattlesSql,
  recentRatingSql,
} from "@unicum.gg/core/players/recent-rating";

export type TopPlayerByLanguageResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  winrate: number | null;
  wnx: number;
  /**
   * The ranked metric over the last 30 days, printed beside the lifetime one,
   * null when the player has not played inside the window. Named after `wnx`
   * for the same reason `wnx` is: it carries whichever metric was asked for,
   * or WNX on a PR or WTR board, which have no 30-day figure.
   * Present on the lifetime boards only.
   */
  wnx_30d?: number | null;
  /** The battles behind `wnx_30d`. */
  battles_30d?: number | null;
  languages: string[];
} & PlayerBadgeFlags;

/**
 * A board and the instant its rows describe. For the materialized language
 * boards that is when the hourly cron rewrote the table; for the global board,
 * which ranks straight off `*_players`, it is the read itself.
 */
export type TopPlayersByLanguage = {
  results: TopPlayerByLanguageResult[];
  computedAt: Date | null;
};

// Lower than the global Overall leaderboard floor (20k) because the
// language-filtered pool is smaller — a 10k floor surfaces enough candidates
// per language for niche communities to produce a useful leaderboard. Matches
// the materialization pool floor in `players/top/ratings.ts`.
const MIN_BATTLES = 10000;

const VALID_METRIC_COLUMNS: Record<string, RatingMetric> = {
  wn7: RatingMetric.Wn7,
  wn8: RatingMetric.Wn8,
  wnx: RatingMetric.Wnx,
  pr: RatingMetric.Pr,
  wtr: RatingMetric.Wtr,
};

async function getTopPlayersGlobal(
  region: Region,
  col: RatingMetric,
  limit: number,
): Promise<TopPlayersByLanguage> {
  // No language filter: just the top N by metric straight off the players
  // table (indexed, cheap) — no inference needed. Mirrors the "All" tab.
  const players = playersByRegion[region];
  const clans = clansByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);
  const rows = (await db.execute(sql`
    SELECT
      p.account_id, p.nickname, p.battles, p.winrate, ${metricCol} AS value,
      ${recentRatingSql(col, "p")} AS recent, ${recentBattlesSql("p")} AS recent_battles,
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
    winrate: number | null;
    value: number | string;
    recent: number | string | null;
    recent_battles: number | null;
    clan_tag: string | null;
    clan_color: string | null;
  }>;
  const results = rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    winrate: r.winrate,
    wnx: Number(r.value),
    wnx_30d: r.recent == null ? null : Number(r.recent),
    battles_30d: r.recent_battles,
    languages: [],
  }));
  return { results, computedAt: new Date() };
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
): Promise<TopPlayersByLanguage> {
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) {
    throw new Error(`top-players by-language: unknown metric ${metric}`);
  }
  if (!language) return getTopPlayersGlobal(region, col, limit);

  const table = playerRatingsByRegion[region];
  const players = playersByRegion[region];
  const metricCol = sql.raw(`r."${col}"`);
  // Strict mode: a player whose inferred set is exactly {language}.
  const langClause = strict
    ? sql`AND r.languages = ARRAY[${language}]::text[]`
    : sql`AND ${language} = ANY(r.languages)`;
  // The 30-day figure lives on the players row, not in the materialized
  // ratings, so the top N are joined back to it: N primary-key lookups.
  const rows = (await db.execute(sql`
    SELECT
      r.account_id, r.nickname, r.battles, r.winrate, ${metricCol} AS value,
      ${recentRatingSql(col, "p")} AS recent, ${recentBattlesSql("p")} AS recent_battles,
      r.clan_tag, r.clan_color, r.languages, r.computed_at
    FROM (
      SELECT * FROM ${table} r
      WHERE ${metricCol} IS NOT NULL
        AND r.battles >= ${MIN_BATTLES}
        ${langClause}
      ORDER BY ${metricCol} DESC
      LIMIT ${limit}
    ) r
    LEFT JOIN ${players} p ON p.account_id = r.account_id
    ORDER BY ${metricCol} DESC
  `)) as unknown as Array<{
    account_id: number | string;
    nickname: string;
    battles: number;
    winrate: number | null;
    value: number | string;
    recent: number | string | null;
    recent_battles: number | null;
    clan_tag: string | null;
    clan_color: string | null;
    languages: string[] | null;
    computed_at: Date | string;
  }>;
  const results = rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    winrate: r.winrate,
    wnx: Number(r.value),
    wnx_30d: r.recent == null ? null : Number(r.recent),
    battles_30d: r.recent_battles,
    languages: r.languages ?? [],
  }));
  // One cron pass rewrites the whole table in one transaction, so every row
  // carries the same stamp.
  return {
    results,
    computedAt: rows[0] ? new Date(rows[0].computed_at) : null,
  };
}

