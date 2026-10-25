import { sql } from "drizzle-orm";
import {
  type PlayerRatingsTable,
  clansByRegion,
  playerRatingsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import { languageInferenceCtes } from "./language-inference";

// Candidate pool per metric, unioned across all five so a player who ranks in
// wn7 but not wnx is still present for the wn7 board. Mirrors CANDIDATE_OVERSHOOT
// in the by-language service.
const CANDIDATE_OVERSHOOT = 10000;
// Minimum battles to enter the pool (matches MIN_BATTLES in the by-language
// service). Below this WNX is statistical noise.
const MIN_BATTLES = 10000;
// Postgres caps a statement at 65535 bind params; ~9 cols/row stays well under.
const INSERT_CHUNK = 2000;

type MaterializedRow = {
  account_id: string | number;
  nickname: string;
  battles: number;
  winrate: number | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  pr: number | null;
  wtr: number | null;
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
  const clans = clansByRegion[region];
  const table = playerRatingsByRegion[region];

  // One top-N per metric rather than a single pass ranking all five with
  // window functions, which reads the table once but sorts the 880k eligible EU
  // rows five times and spills each sort to disk: measured 4.3s against 1.4s
  // for three of these, each a heap top-N that never sorts more than it keeps.
  const candFor = (col: string) =>
    sql`(
      SELECT p.account_id, p.nickname, p.clan_id, p.battles, p.winrate,
        p."wn7" AS wn7, p."wn8" AS wn8, p."wnx" AS wnx,
        p."pr" AS pr, p."wtr" AS wtr
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
          account_id, nickname, clan_id, battles, winrate, wn7, wn8, wnx, pr, wtr
        FROM (
          ${candFor("wnx")}
          UNION ALL
          ${candFor("wn8")}
          UNION ALL
          ${candFor("wn7")}
          UNION ALL
          ${candFor("pr")}
          UNION ALL
          ${candFor("wtr")}
        ) u
      ),
      ${languageInferenceCtes(region, sql`SELECT account_id FROM cands`)}
      SELECT c.account_id, c.nickname, c.battles, c.winrate, c.wn7, c.wn8, c.wnx,
        c.pr, c.wtr, l.languages,
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
      winrate: r.winrate,
      wn7: r.wn7,
      wn8: r.wn8,
      wnx: r.wnx,
      pr: r.pr,
      wtr: r.wtr,
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
