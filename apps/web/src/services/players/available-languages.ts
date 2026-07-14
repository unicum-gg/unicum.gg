import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@unicum.gg/core/db";
import {
  playerClanHistoryByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { type Region } from "@unicum.gg/wargaming";

// Match the overshoot pool used by `getTopPlayersByLanguage`: chip
// counts then describe the same population that the leaderboard ranks
// from, so chip "fr 257" matches the actual hits behind `/players/lang/fr`.
const CANDIDATE_POOL = 10000;
const MIN_BATTLES = 10000;
const KEEP_RATIO = 0.5;

export type PlayerLanguageStats = {
  code: string;
  total: number;
  strict: number;
};

async function getPlayerLanguageStatsUncached(
  region: Region,
): Promise<PlayerLanguageStats[]> {
  const players = playersByRegion[region];
  const history = playerClanHistoryByRegion[region];
  // JIT off inside a one-shot transaction: `SET LOCAL` requires a
  // transaction block. Same trick as `getTopPlayersByLanguage`. Without
  // this the per-call JIT compile adds ~4s for the rest of the CTE chain.
  //
  // Same CTE chain as the leaderboard, but instead of joining back to
  // `top_cands` for ranked output we aggregate per language: total =
  // players with this language among their survivors, strict = players
  // whose single survivor is this language.
  const rows = (await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL jit = off`);
    return tx.execute(sql`
    WITH top_cands AS (
      SELECT p.account_id FROM ${players} p
      WHERE p.wnx IS NOT NULL
        AND p.battles >= ${MIN_BATTLES}
        AND p.soft_deleted_at IS NULL
      ORDER BY p.wnx DESC
      LIMIT ${CANDIDATE_POOL}
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
      SELECT h.account_id, s->'clan'->'languages',
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
    per_player AS (
      SELECT account_id, COUNT(*)::int AS n_langs
      FROM survivors
      GROUP BY account_id
    )
    SELECT s.lang AS code,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE pp.n_langs = 1)::int AS strict
    FROM survivors s
    INNER JOIN per_player pp USING (account_id)
    GROUP BY s.lang
    ORDER BY total DESC
  `);
  })) as unknown as Array<{ code: string; total: number; strict: number }>;
  return rows.map((r) => ({
    code: r.code,
    total: r.total,
    strict: r.strict,
  }));
}

const getPlayerLanguageStatsCached = unstable_cache(
  getPlayerLanguageStatsUncached,
  ["player-language-stats"],
  { revalidate: 3600, tags: ["top-players"] },
);

/**
 * Inferred languages of the top-WNX candidate pool in the given region,
 * with `total` (player has this language among their dominant set) and
 * `strict` (player's single dominant language). Same pool the
 * leaderboard queries from so chip counts and page results agree.
 */
export function getPlayerLanguageStats(
  region: Region,
): Promise<PlayerLanguageStats[]> {
  return getPlayerLanguageStatsCached(region);
}
