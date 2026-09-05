import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  playerNameHistoryByRegion,
  playersByRegion,
  tournamentTeamPlayersByRegion,
  tournamentsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Feed the rename history from tournament rosters.
 *
 * `player_name_history` can only ever grow FORWARDS on its own: a trigger on the
 * players table appends the old nickname the moment a refresh writes a new one,
 * so it knows nothing from before we started tracking an account. Wargaming
 * publishes no rename history to fill that in.
 *
 * Tournament rosters do, from the other direction. Wargaming freezes the
 * nickname a player registered under, so every roster line is a dated
 * observation of the form "on this day, this account was called X" going back to
 * 2018. Measured on EU: 7,061 roster names differ from the account's current
 * one and 6,803 of those are unknown to the history, against 3,753 rows in it
 * today. Nothing else can recover them.
 *
 * This is the same move `reconcileOnslaught` already makes from the Onslaught
 * boards, which is why the shape matches it: a name that differs from the
 * current one is a genuine former name, inserted once.
 */

/**
 * `recorded_at` means "when this name stopped being current", and a roster only
 * proves the name was still in use ON that day. The LATEST tournament an account
 * played under a name is therefore the closest bound available, and it is a
 * lower one: the rename happened at that date or after it. The Onslaught
 * reconciler makes the same approximation with a season's end date.
 */
function insertMissingNames(region: Region, tournamentId?: number) {
  const rosters = tournamentTeamPlayersByRegion[region];
  const players = playersByRegion[region];
  const history = playerNameHistoryByRegion[region];
  const tournaments = tournamentsByRegion[region];
  const scope = tournamentId
    ? sql`AND r.${sql.raw(rosters.tournamentId.name)} = ${tournamentId}`
    : sql``;

  return db.execute<{ account_id: string; nickname: string }>(sql`
    INSERT INTO ${history} (
      ${sql.raw(history.accountId.name)},
      ${sql.raw(history.nickname.name)},
      ${sql.raw(history.recordedAt.name)}
    )
    SELECT r.${sql.raw(rosters.accountId.name)},
           MIN(r.${sql.raw(rosters.nickname.name)}),
           MAX(t.${sql.raw(tournaments.startAt.name)})
    FROM ${rosters} r
    JOIN ${players} p
      ON p.${sql.raw(players.accountId.name)} = r.${sql.raw(rosters.accountId.name)}
    JOIN ${tournaments} t
      ON t.${sql.raw(tournaments.id.name)} = r.${sql.raw(rosters.tournamentId.name)}
    WHERE LOWER(r.${sql.raw(rosters.nickname.name)})
          <> LOWER(p.${sql.raw(players.nickname.name)})
      ${scope}
      AND NOT EXISTS (
        SELECT 1 FROM ${history} h
        WHERE h.${sql.raw(history.accountId.name)} = r.${sql.raw(rosters.accountId.name)}
          AND LOWER(h.${sql.raw(history.nickname.name)})
              = LOWER(r.${sql.raw(rosters.nickname.name)})
      )
    -- Grouped by the LOWERCASED name so one account that registered as "Foo"
    -- and "foo" contributes a single row rather than two spellings of one name.
    GROUP BY r.${sql.raw(rosters.accountId.name)},
             LOWER(r.${sql.raw(rosters.nickname.name)})
    RETURNING ${sql.raw(history.accountId.name)}::text AS account_id,
              ${sql.raw(history.nickname.name)} AS nickname
  `);
}

/** Former names recovered from one tournament's rosters, run as part of the
 * mirror so a new tournament contributes as it lands. */
export async function recordRosterNames(
  region: Region,
  tournamentId: number,
): Promise<number> {
  const rows = await insertMissingNames(region, tournamentId);
  return rows.length;
}

/** The same over a region's whole mirrored archive, for the one-time catch-up.
 * One statement rather than a loop: it is a set operation, and the set is small
 * (thousands of rows) even though the rosters it reads are hundreds of
 * thousands. */
export async function backfillRosterNames(region: Region): Promise<number> {
  const rows = await insertMissingNames(region);
  return rows.length;
}
