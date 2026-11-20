import { sql } from "drizzle-orm";
import { battlesByRegion, playersByRegion } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Add to the players table every account a stored battle names and we do not
 * hold yet.
 *
 * The catch-up half of what `recordBattles` now does on arrival (see
 * `discoverParticipants` in `./ingest`): the battles stored before it named
 * accounts nothing else ever led us to, chiefly anonymized players and players
 * in no clan, and their pages showed "unknown" for them.
 *
 * One statement, and the same shape `discoverPlayers` writes: an empty name and
 * a `last_seen_at` at the epoch, which is what puts the account at the head of
 * the snapshot pipeline's queue, where the name is read. Idempotent, so a second
 * run inserts nothing.
 */
export async function discoverStoredBattleParticipants(
  region: Region,
): Promise<number> {
  const battles = battlesByRegion[region];
  const players = playersByRegion[region];
  const inserted = await db.execute(sql`
    INSERT INTO ${players} (account_id, nickname, last_seen_at)
    SELECT DISTINCT acc, '', to_timestamp(0)
    FROM ${battles}, unnest(${battles.playerIds}) AS acc
    WHERE acc > 0
      AND NOT EXISTS (SELECT 1 FROM ${players} p WHERE p.account_id = acc)
    ORDER BY acc
    ON CONFLICT DO NOTHING
    RETURNING account_id
  `);
  return inserted.length;
}
