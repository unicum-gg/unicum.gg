import { sql } from "drizzle-orm";
import {
  MARKS_MIN_BATTLES,
  type LanguageStint,
  playerMarksByRegion,
  playersByRegion,
  playerClanHistoryByRegion,
  scoreLanguageStints,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Fill in which language each account on the Marks of Excellence board speaks.
 *
 * The board needs its own pass because the one that already exists cannot serve
 * it: `*_player_ratings` carries the same inference precomputed, but only for
 * accounts with ten thousand battles that place in a rating metric's top ten
 * thousand, and a player who three-marks half a garage is under no obligation
 * to be either. Most of this board is simply not in that table.
 *
 * What it must not do is answer differently. The scoring is
 * `scoreLanguageStints`, the shared function the player page and
 * `resolveLanguages` both end at, so an account cannot be French on its profile
 * and German here. Only the READING is local: the stints come out of the stored
 * history document in SQL rather than as deserialized objects, because pulling
 * the whole document for forty thousand accounts would move a hundred megabytes
 * of clan metadata to score a handful of two-letter codes.
 *
 * Hourly, riding the top-players cron beside `recomputePlayerRatings`: a clan
 * stint moves on a schedule of its own, with nothing to do with whether a mark
 * was earned, so this cannot live on the write path.
 */
export async function recomputeMarksLanguages(
  region: Region,
): Promise<number> {
  const marks = playerMarksByRegion[region];
  const players = playersByRegion[region];
  const history = playerClanHistoryByRegion[region];

  // One row per (account, stint): the clan's declared languages and how long
  // the stay lasted. A current stint runs to now, a past one to its own
  // `leftAt`, and a stint that never ended and is not current is dropped (it
  // has no duration to attribute).
  const rows = (await db.execute(sql`
    WITH ranked AS (
      SELECT ${marks.accountId} AS account_id
      FROM ${marks}
      INNER JOIN ${players} p ON p.account_id = ${marks.accountId}
      WHERE ${marks.marks3Total} > 0
        AND p.battles >= ${MARKS_MIN_BATTLES}
        AND p.soft_deleted_at IS NULL
    )
    SELECT h.account_id,
      h.data->'currentStint'->'clan'->'languages' AS languages,
      EXTRACT(EPOCH FROM
        NOW() - (h.data->'currentStint'->>'joinedAt')::timestamptz
      ) * 1000 AS duration_ms
    FROM ${history} h
    INNER JOIN ranked r ON r.account_id = h.account_id
    WHERE h.data->'currentStint' IS NOT NULL
    UNION ALL
    SELECT h.account_id,
      s->'clan'->'languages',
      EXTRACT(EPOCH FROM
        ((s->>'leftAt')::timestamptz - (s->>'joinedAt')::timestamptz)
      ) * 1000
    FROM ${history} h
    INNER JOIN ranked r ON r.account_id = h.account_id,
      LATERAL jsonb_array_elements(h.data->'pastStints') s
    WHERE s->>'leftAt' IS NOT NULL
  `)) as unknown as Array<{
    account_id: number | string;
    languages: string[] | null;
    duration_ms: number | string | null;
  }>;

  const byAccount = new Map<number, LanguageStint[]>();
  for (const row of rows) {
    const accountId = Number(row.account_id);
    if (!row.languages || row.languages.length === 0) continue;
    const durationMs = Number(row.duration_ms);
    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
    const stints = byAccount.get(accountId) ?? [];
    stints.push({ languages: row.languages, durationMs });
    byAccount.set(accountId, stints);
  }

  const values: Array<{ accountId: number; languages: string[] }> = [];
  for (const [accountId, stints] of byAccount) {
    const languages = scoreLanguageStints(stints);
    if (languages.length > 0) values.push({ accountId, languages });
  }
  if (values.length === 0) return 0;

  // One statement per chunk, driven off a VALUES list rather than a row at a
  // time: the pass is hourly and a per-row UPDATE for forty thousand accounts
  // would hold a connection from the shared background pool for minutes.
  //
  // The accounts that resolved to NOTHING are deliberately left alone rather
  // than blanked. An account with no clan history has no inferred language and
  // never had one, so there is nothing to clear, and an account that HAD one
  // keeps it: a history read that came back short should not quietly drop a
  // player off every language board until the next pass.
  const CHUNK = 2000;
  let written = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    // Each language array is written as an explicit `ARRAY[...]` of single
    // binds rather than as one array parameter. Drizzle renders a JS array
    // inside a `sql` template as a comma-separated PARAMETER LIST, so
    // `${v.languages}::text[]` came out as `($22, $23)::text[]`, which
    // Postgres refuses outright for two codes and silently casts a row for
    // one. Building the constructor keeps every code its own bind, so nothing
    // here is string-concatenated into SQL either.
    const tuples = sql.join(
      chunk.map(
        (v) => sql`(${v.accountId}::bigint, ARRAY[${sql.join(
          v.languages.map((lang) => sql`${lang}`),
          sql`, `,
        )}]::text[])`,
      ),
      sql`, `,
    );
    await db.execute(sql`
      UPDATE ${marks} AS m
      SET languages = v.languages
      FROM (VALUES ${tuples}) AS v(account_id, languages)
      WHERE m.account_id = v.account_id
        AND m.languages IS DISTINCT FROM v.languages
    `);
    written += chunk.length;
  }
  return written;
}
