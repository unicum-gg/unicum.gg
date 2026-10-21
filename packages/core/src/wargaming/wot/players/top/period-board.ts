import { sql } from "drizzle-orm";
import {
  DEFAULT_TIER_FLOOR,
  RatingMetric,
  type TierFloor,
  playerPeriodRatingsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import type { RecentPeriod } from "./period-ratings";

export type PeriodBoardRow = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  /** Battles inside the window. */
  battles: number;
  /** Win rate (0-1) inside the window. */
  winrate: number | null;
  /** The ranked metric over the window, named `wnx` like every board row. */
  wnx: number;
  languages: string[];
};

/** A window's board and when the hourly cron last rewrote it. */
export type PeriodBoard = { results: PeriodBoardRow[]; computedAt: Date | null };

const METRIC_COLUMN: Record<RatingMetric, string> = {
  [RatingMetric.Wn7]: "wn7",
  [RatingMetric.Wn8]: "wn8",
  [RatingMetric.Wnx]: "wnx",
};

/**
 * One recent window's player board at one tier floor, optionally narrowed to a
 * language.
 *
 * A cheap indexed read of `*_player_period_ratings`, which the top-players
 * cron fills with every eligible account: the unfiltered board walks the
 * `(period, <metric> DESC)` index, and a language narrows through the GIN
 * index first, the lifetime language board's own shape. `strict` is the same
 * reading as there: the inferred set is exactly this language.
 */
export async function getPeriodBoard(
  region: Region,
  {
    metric,
    period,
    minTier = DEFAULT_TIER_FLOOR,
    language = null,
    strict = false,
    limit,
  }: {
    metric: RatingMetric;
    period: RecentPeriod;
    /** Only the battles at or above this tier are counted. */
    minTier?: TierFloor;
    language?: string | null;
    strict?: boolean;
    limit: number;
  },
): Promise<PeriodBoard> {
  const table = playerPeriodRatingsByRegion[region];
  const col = sql.raw(`"${METRIC_COLUMN[metric]}"`);
  const langClause = !language
    ? sql``
    : strict
      ? sql`AND languages = ARRAY[${language}]::text[]`
      : sql`AND languages @> ARRAY[${language}]::text[]`;
  const rows = (await db.execute(sql`
    SELECT account_id, nickname, clan_tag, clan_color, battles, wins,
      ${col} AS value, languages, computed_at
    FROM ${table}
    WHERE period = ${period}
      AND min_tier = ${minTier}
      AND ${col} IS NOT NULL
      ${langClause}
    ORDER BY ${col} DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    account_id: number | string;
    nickname: string;
    clan_tag: string | null;
    clan_color: string | null;
    battles: number;
    wins: number | null;
    value: number | string;
    languages: string[] | null;
    computed_at: Date | string;
  }>;
  const results = rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    clan_tag: r.clan_tag,
    clan_color: r.clan_color,
    battles: r.battles,
    winrate: r.wins == null || r.battles === 0 ? null : r.wins / r.battles,
    wnx: Number(r.value),
    languages: r.languages ?? [],
  }));
  // The pass rewrites every window in one transaction, so the rows share it.
  return {
    results,
    computedAt: rows[0] ? new Date(rows[0].computed_at) : null,
  };
}

export type PeriodLanguageStats = { code: string; total: number; strict: number };

/**
 * The languages present on one recent window's board (at one tier floor),
 * counted over the very
 * pool it ranks, so a chip's count is the number of rows behind it. The
 * lifetime twin is `getPlayerLanguageStats` over `*_player_ratings`.
 */
export async function getPeriodLanguageStats(
  region: Region,
  period: RecentPeriod,
  minTier: TierFloor = DEFAULT_TIER_FLOOR,
): Promise<PeriodLanguageStats[]> {
  const table = playerPeriodRatingsByRegion[region];
  const rows = (await db.execute(sql`
    SELECT lang AS code,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cardinality(languages) = 1)::int AS strict
    FROM ${table}, unnest(languages) AS lang
    WHERE period = ${period} AND min_tier = ${minTier}
    GROUP BY lang
    ORDER BY total DESC
  `)) as unknown as PeriodLanguageStats[];
  return rows.map((r) => ({ code: r.code, total: r.total, strict: r.strict }));
}
