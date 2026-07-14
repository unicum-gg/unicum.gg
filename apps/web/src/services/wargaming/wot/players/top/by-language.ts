import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  clansByRegion,
  playerClanHistoryByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";

export type TopPlayerByLanguageResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wnx: number;
  languages: string[];
};

// Overshoot pool: we run the language inference over the top N
// candidates by overall WNX, then filter to the requested language.
// 10000 covers the ~17 most-spoken languages with ≥100 players (en, uk,
// pl, de, ru, cs, sk, hu, sr, fr, hr, ro, be, tr, bs, fi, nl on EU);
// niche languages may return fewer than `limit` rows, which is fine.
const CANDIDATE_OVERSHOOT = 10000;
// Lower than the global Overall leaderboard floor (20k) because the
// language-filtered pool is smaller — a 10k floor surfaces enough
// candidates per language for niche communities to produce a useful
// leaderboard. Below 10k WNX is statistical noise.
const MIN_BATTLES = 10000;
// Keep-ratio for the inference, matches `inferPlayerLanguages` in
// `@unicum.gg/core/players/language-inference`. Any language scoring at least
// half the player's top language survives.
const KEEP_RATIO = 0.5;

const VALID_METRIC_COLUMNS: Record<string, string> = {
  wn7: "wn7",
  wn8: "wn8",
  wnx: "wnx",
};

async function getTopPlayersByLanguageUncached(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean,
): Promise<TopPlayerByLanguageResult[]> {
  const col = VALID_METRIC_COLUMNS[metric];
  if (!col) {
    throw new Error(`top-players by-language: unknown metric ${metric}`);
  }
  const players = playersByRegion[region];
  const history = playerClanHistoryByRegion[region];
  const clans = clansByRegion[region];
  const metricCol = sql.raw(`p."${col}"`);

  // No filter: just the top N by metric, no need for the inference CTE
  // chain at all. Mirrors the "All" tab on /clans.
  if (!language) {
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

  // Two-phase strategy: pull the top-N candidates by metric (cheap, hits
  // an index), then run the per-player language inference over only
  // those rows. Trying to infer across the entire history table first
  // costs ~25s; pre-filtering keeps it under 2s.
  //
  // Strict mode: a player whose inferred set is exactly {language}.
  // Mirrors /clans where "strict" = clan declared only this language.
  const strictClause = strict
    ? sql`HAVING bool_and(lang = ${language})`
    : sql`HAVING bool_or(lang = ${language})`;

  // JIT off via a one-shot transaction: tested on prod EU, JIT adds ~4s
  // of compile overhead for this single execution (~6s with, ~2s
  // without). `SET LOCAL` requires a transaction block; plain `SET`
  // would leak to the pooled connection. Cache amortises but the first
  // hit per period stings without this.
  const rows = (await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL jit = off`);
    return tx.execute(sql`
    WITH top_cands AS (
      SELECT p.account_id, p.nickname, p.clan_id, p.battles,
        ${metricCol} AS value
      FROM ${players} p
      WHERE ${metricCol} IS NOT NULL
        AND p.battles >= ${MIN_BATTLES}
        AND p.soft_deleted_at IS NULL
      ORDER BY ${metricCol} DESC
      LIMIT ${CANDIDATE_OVERSHOOT}
    ),
    histories AS (
      SELECT h.account_id, h.data
      FROM ${history} h
      WHERE h.account_id IN (SELECT account_id FROM top_cands)
    ),
    stints AS (
      SELECT h.account_id,
        h.data->'currentStint'->'clan'->'languages' AS langs,
        EXTRACT(EPOCH FROM
          NOW() - (h.data->'currentStint'->>'joinedAt')::timestamptz
        ) AS duration_s
      FROM histories h
      WHERE h.data->'currentStint' IS NOT NULL
      UNION ALL
      SELECT h.account_id,
        s->'clan'->'languages',
        EXTRACT(EPOCH FROM
          ((s->>'leftAt')::timestamptz - (s->>'joinedAt')::timestamptz)
        )
      FROM histories h, LATERAL jsonb_array_elements(h.data->'pastStints') s
      WHERE s->>'leftAt' IS NOT NULL
    ),
    expanded AS (
      SELECT account_id, lang,
        duration_s / NULLIF(jsonb_array_length(langs), 0) AS share
      FROM stints, LATERAL jsonb_array_elements_text(langs) lang
      WHERE jsonb_array_length(langs) > 0 AND duration_s > 0
    ),
    scores AS (
      SELECT account_id, lang, SUM(share) AS score
      FROM expanded GROUP BY account_id, lang
    ),
    ranked AS (
      SELECT account_id, lang, score,
        MAX(score) OVER (PARTITION BY account_id) AS max_score
      FROM scores
    ),
    survivors AS (
      SELECT account_id, lang
      FROM ranked
      WHERE score >= max_score * ${KEEP_RATIO}
    ),
    matched AS (
      SELECT account_id,
        array_agg(lang ORDER BY lang) AS languages
      FROM survivors
      GROUP BY account_id
      ${strictClause}
    )
    SELECT tc.account_id, tc.nickname, tc.battles, tc.value,
      m.languages,
      cl.tag AS clan_tag, cl.color AS clan_color
    FROM top_cands tc
    INNER JOIN matched m USING (account_id)
    LEFT JOIN ${clans} cl ON cl.id = tc.clan_id
    ORDER BY tc.value DESC
    LIMIT ${limit}
  `);
  })) as unknown as Array<{
    account_id: number | string;
    nickname: string;
    battles: number;
    value: number | string;
    languages: string[];
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
    languages: r.languages ?? [],
  }));
}

const getTopPlayersByLanguageCached = unstable_cache(
  getTopPlayersByLanguageUncached,
  ["top-players-by-language"],
  { revalidate: 600, tags: ["top-players"] },
);

/**
 * Region-scoped top players, optionally filtered by inferred language.
 * Inference walks the player's clan history (current + past stints) and
 * accumulates language scores weighted by time spent. A language survives
 * if it scores at least half the player's leader. Mirrors
 * `inferPlayerLanguages` used on the player page. 10-minute cache.
 */
export function getTopPlayersByLanguage(
  region: Region,
  metric: string,
  language: string | null,
  limit: number,
  strict: boolean = false,
): Promise<TopPlayerByLanguageResult[]> {
  return getTopPlayersByLanguageCached(region, metric, language, limit, strict);
}
