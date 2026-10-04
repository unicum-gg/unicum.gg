import { sql, type SQL } from "drizzle-orm";
import {
  mapRatings,
  playersByRegion,
  tankRatings,
  VoterBracket,
} from "@unicum.gg/shared";
import { REGIONS } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/**
 * Keeping the stored bracket in step with how the voter plays now, across every
 * community rating table.
 *
 * Its own module because it belongs to neither feature. A vote records who cast
 * it at the moment it was cast, which is right for the evidence columns about
 * the SUBJECT: the opinion rested on that record and rewriting it would be
 * rewriting history.
 *
 * The columns about the VOTER are the exception, and they move together: the
 * bracket is the axis every community split is read on, and the account rating
 * and battle count are what the reviews print beside a name. Left frozen, a
 * player who was average two years ago goes on speaking for the average bracket
 * forever, and the "unicums rate it higher" line slowly stops being true of
 * anybody.
 *
 * Run once per tick for both tables rather than once per feature: it is one
 * fact about the accounts, and two passes would be two full-table updates to
 * compute it twice.
 */

/** The cuts `voterBracket` applies, restated in SQL because the relabelling has
 * to happen in the database: reading a million votes back through TypeScript to
 * compute four comparisons would be a million round trips. */
function bracketCase(): SQL<unknown> {
  return sql`CASE
    WHEN p.wn8 IS NULL THEN ${VoterBracket.Unknown}
    WHEN p.wn8 < 900 THEN ${VoterBracket.Learning}
    WHEN p.wn8 < 1600 THEN ${VoterBracket.Average}
    WHEN p.wn8 < 2350 THEN ${VoterBracket.Strong}
    ELSE ${VoterBracket.Unicum}
  END`;
}

/**
 * Every region's player rows as one relation.
 *
 * One branch per region, because the players tables are physically separate and
 * a vote carries the region it was cast from. Built rather than written out so
 * adding a fourth server is a change to `REGIONS`, not to this query.
 */
function playerSource(): SQL<unknown> {
  const branches = REGIONS.map(
    (region) => sql`
      SELECT account_id, wn8, battles, battles_30d, winrate, ${region} AS region
      FROM ${playersByRegion[region]}
    `,
  );
  return sql.join(branches, sql` UNION ALL `);
}

/**
 * The vehicle votes, which carry no account win rate: a vehicle review prints
 * the author's record on that exact tank, so the account's own win rate is not
 * a column on the row.
 */
async function refreshTankVoterBrackets(): Promise<void> {
  await db.execute(sql`
    UPDATE ${tankRatings} r
    SET
      player_wn8 = p.wn8,
      player_battles = p.battles,
      bracket = ${bracketCase()}
    FROM (${playerSource()}) p
    WHERE p.account_id = r.account_id
      AND p.region = r.region
      -- Only the rows that actually move. Postgres writes a new tuple version
      -- for every row an UPDATE touches whether or not the values changed, so
      -- an unguarded statement rewrites the whole table every hour and leaves
      -- that many dead tuples and that much WAL behind it. Most accounts do not
      -- change bracket between two ticks. This project has already had the
      -- shared database fall over under an hourly recompute burst.
      AND (r.player_wn8, r.player_battles, r.bracket) IS DISTINCT FROM (
        p.wn8, p.battles, ${bracketCase()}
      )
  `);
}

/**
 * The map votes, which carry two more columns for the same reason the vehicle
 * ones carry fewer: there is no per-arena record to sign a review with, so the
 * account's own win rate and its trailing thirty days are the evidence, and
 * they are as live a fact about the voter as the bracket is.
 */
async function refreshMapVoterBrackets(): Promise<void> {
  await db.execute(sql`
    UPDATE ${mapRatings} r
    SET
      player_wn8 = p.wn8,
      player_battles = p.battles,
      player_recent_battles = p.battles_30d,
      player_winrate = p.winrate,
      bracket = ${bracketCase()}
    FROM (${playerSource()}) p
    WHERE p.account_id = r.account_id
      AND p.region = r.region
      AND (
        r.player_wn8,
        r.player_battles,
        r.player_recent_battles,
        r.player_winrate,
        r.bracket
      ) IS DISTINCT FROM (
        p.wn8, p.battles, p.battles_30d, p.winrate, ${bracketCase()}
      )
  `);
}

/** Relabel every community vote from its voter's current record. */
export async function refreshVoterBrackets(): Promise<void> {
  await refreshTankVoterBrackets();
  await refreshMapVoterBrackets();
}
