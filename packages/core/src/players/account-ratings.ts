import { sql } from "drizzle-orm";
import { playerSnapshotsByRegion, playersByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Copy each account's latest Personal Rating and WTR onto its player row.
 *
 * The snapshot path writes both on every read of `account/info` (see
 * `recordCurrentSnapshot`), so a row converges on its own the next time the
 * account plays. What it never reaches is the account that stopped: migration
 * 0135 added the columns empty, and a player idle since spring would stay off
 * every PR and WTR board indefinitely. The values are already in the
 * snapshots, so this is a copy rather than a Wargaming call.
 *
 * Walks the table in pages of real ids (keyset on the primary key) rather than
 * in fixed id ranges: the id sequence is mostly gaps, since every conflicting
 * upsert of a player row consumes a value (EU's ids run to 136 million for two
 * million rows), so a range walk spent 98% of its time on empty ranges and was
 * measured at about thirty hours. Each page is one statement, so it holds its
 * row locks briefly against a table the snapshot pipeline writes to the whole
 * time, and an interrupted run can resume with `from`. Only touches a column
 * still holding a null, so it is idempotent and never overwrites a value the
 * live path wrote since.
 */
export async function backfillAccountRatings(
  region: Region,
  options: { from?: number; step?: number; onProgress?: (at: number, written: number) => void } = {},
): Promise<number> {
  const players = playersByRegion[region];
  const snapshots = playerSnapshotsByRegion[region];
  const step = options.step ?? 2000;

  let written = 0;
  let after = options.from ?? 0;
  for (;;) {
    const [page] = await db.execute<{ last: number | null; written: number }>(
      sql`WITH batch AS (
            SELECT id FROM ${players}
            WHERE id > ${after}
            ORDER BY id
            LIMIT ${step}
          ),
          latest AS (
            SELECT b.id AS player_id, s.global_rating, s.wtr
            FROM batch b
            CROSS JOIN LATERAL (
              SELECT global_rating, wtr FROM ${snapshots}
              WHERE player_id = b.id
              ORDER BY taken_at DESC, id DESC
              LIMIT 1
            ) s
          ),
          updated AS (
            UPDATE ${players} AS p
            SET pr = COALESCE(p.pr, latest.global_rating),
                wtr = COALESCE(p.wtr, latest.wtr)
            FROM latest
            WHERE p.id = latest.player_id
              AND (p.pr IS NULL OR (p.wtr IS NULL AND latest.wtr IS NOT NULL))
            RETURNING p.id
          )
          SELECT (SELECT max(id) FROM batch) AS last,
                 (SELECT count(*) FROM updated)::int AS written`,
    );
    if (page.last === null) break;
    after = Number(page.last);
    written += page.written;
    options.onProgress?.(after, written);
  }
  return written;
}
