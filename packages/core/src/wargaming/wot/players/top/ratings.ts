import { sql } from "drizzle-orm";
import {
  type PlayerRatingsTable,
  clansByRegion,
  playerClanHistoryByRegion,
  playerRatingsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

// Candidate pool per metric, unioned across all three so a player who ranks in
// wn7 but not wnx is still present for the wn7 board. Mirrors CANDIDATE_OVERSHOOT
// in the by-language service.
const CANDIDATE_OVERSHOOT = 10000;
// Minimum battles to enter the pool (matches MIN_BATTLES in the by-language
// service). Below this WNX is statistical noise.
const MIN_BATTLES = 10000;
// A language survives inference if it scores at least half the player's leader
// (matches KEEP_RATIO / `inferPlayerLanguages`).
const KEEP_RATIO = 0.5;
// Postgres caps a statement at 65535 bind params; ~9 cols/row stays well under.
const INSERT_CHUNK = 2000;

type MaterializedRow = {
  account_id: string | number;
  nickname: string;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  languages: string[] | null;
  clan_tag: string | null;
  clan_color: string | null;
};

type InsertValue = PlayerRatingsTable["$inferInsert"];

/**
 * Recompute the materialized language-inferred player ratings for a region and
 * replace the region's `player_ratings` table. This pays the expensive
 * two-phase work once per hour in the background: pull the top candidates by
 * each metric (indexed), then infer each candidate's languages from their clan
 * history (time-weighted stint scoring), so the by-language board can serve a
 * cheap indexed read. Inference logic mirrors exactly `getTopPlayersByLanguage`
 * and `inferPlayerLanguages`; only accounts with at least one inferred language
 * are stored (the table is read solely with a language filter).
 */
export async function recomputePlayerRatings(region: Region): Promise<number> {
  const players = playersByRegion[region];
  const history = playerClanHistoryByRegion[region];
  const clans = clansByRegion[region];
  const table = playerRatingsByRegion[region];

  const candFor = (col: string) =>
    sql`(
      SELECT p.account_id, p.nickname, p.clan_id, p.battles,
        p."wn7" AS wn7, p."wn8" AS wn8, p."wnx" AS wnx
      FROM ${players} p
      WHERE p.${sql.raw(`"${col}"`)} IS NOT NULL
        AND p.battles >= ${MIN_BATTLES}
        AND p.soft_deleted_at IS NULL
      ORDER BY p.${sql.raw(`"${col}"`)} DESC
      LIMIT ${CANDIDATE_OVERSHOOT}
    )`;

  // JIT off (matches the by-language service): the compile overhead dwarfs the
  // single execution's runtime for this shape. SET LOCAL needs a transaction.
  const rows = (await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL jit = off`);
    return tx.execute(sql`
      WITH cands AS (
        SELECT DISTINCT ON (account_id)
          account_id, nickname, clan_id, battles, wn7, wn8, wnx
        FROM (
          ${candFor("wnx")}
          UNION ALL
          ${candFor("wn8")}
          UNION ALL
          ${candFor("wn7")}
        ) u
      ),
      histories AS (
        SELECT h.account_id, h.data
        FROM ${history} h
        WHERE h.account_id IN (SELECT account_id FROM cands)
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
      langs AS (
        SELECT account_id, array_agg(lang ORDER BY lang) AS languages
        FROM survivors
        GROUP BY account_id
      )
      SELECT c.account_id, c.nickname, c.battles, c.wn7, c.wn8, c.wnx,
        l.languages,
        cl.tag AS clan_tag, cl.color AS clan_color
      FROM cands c
      INNER JOIN langs l USING (account_id)
      LEFT JOIN ${clans} cl ON cl.id = c.clan_id
    `);
  })) as unknown as MaterializedRow[];

  const values: InsertValue[] = rows
    .filter((r) => (r.languages?.length ?? 0) > 0)
    .map((r) => ({
      accountId: Number(r.account_id),
      nickname: r.nickname,
      battles: r.battles,
      wn7: r.wn7,
      wn8: r.wn8,
      wnx: r.wnx,
      languages: r.languages ?? [],
      clanTag: r.clan_tag,
      clanColor: r.clan_color,
    }));

  await db.transaction(async (tx) => {
    await tx.delete(table);
    for (let i = 0; i < values.length; i += INSERT_CHUNK) {
      await tx.insert(table).values(values.slice(i, i + INSERT_CHUNK));
    }
  });

  return values.length;
}
