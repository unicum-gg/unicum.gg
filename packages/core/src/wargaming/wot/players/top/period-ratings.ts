import { sql, type SQL } from "drizzle-orm";
import {
  TOP_PLAYERS_MIN_BATTLES,
  clansByRegion,
  playerPeriodRatingsByRegion,
  playerTierWindowRatingsByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";
import { PERIOD_WINDOW, TopPlayersPeriod } from ".";
import { languageInferenceCtes } from "./language-inference";

/** The windows this table holds, everything but the lifetime one. */
export const RECENT_PERIODS = [
  TopPlayersPeriod.Day,
  TopPlayersPeriod.Week,
  TopPlayersPeriod.Month,
] as const;
export type RecentPeriod = (typeof RECENT_PERIODS)[number];

export function isRecentPeriod(period: TopPlayersPeriod): period is RecentPeriod {
  return period !== TopPlayersPeriod.Overall;
}

/** How old a stored inference may get before a tick redoes it. */
const LANGUAGES_TTL = "24 hours";

/**
 * Accounts a single tick re-infers at most.
 *
 * The full EU pool is ~86,000 accounts and inferring all of them took 65s, most
 * of it reading their clan histories, which is too much to run hourly against
 * the database every page shares. A day's TTL spreads that pool over ~3,600 an
 * hour, so the cap is there for the moments that are not steady: a deploy, an
 * evening that pulls thousands of returning players into the 24h pool. What
 * does not fit keeps its previous answer (or none yet) and is first in line
 * next hour, oldest first.
 */
const HOURLY_INFER_CAP = 15000;

/**
 * Who a window ranks, and on what. The WN ratings are the window's own; PR and
 * WTR are the account's current figure, since neither exists over a window, so
 * on those two the board ranks the accounts active inside it.
 *
 * Who it ranks: its battle floor counted over the battles at or above
 * each tier floor, played inside it, not deleted.
 *
 * The per-floor ratings are written by the snapshot path, which already drops
 * a row under the battle floor; the floor is applied again here so a change to
 * it takes effect on the next pass rather than on each account's next battle.
 * The rows are only rewritten when an account moves, so the `last_battle_at`
 * guard is what keeps a player who stopped in April off the board for "the
 * past 7 days" they last played in.
 */
function poolFor(region: Region, period: RecentPeriod): SQL {
  const players = playersByRegion[region];
  const tier = playerTierWindowRatingsByRegion[region];
  return sql`
    SELECT ${period}::text AS period, ${tier.minTier} AS min_tier,
      ${players.accountId} AS account_id,
      ${players.nickname} AS nickname, ${players.clanId} AS clan_id,
      ${tier.battles} AS battles, ${tier.wins} AS wins,
      ${tier.wn7} AS wn7, ${tier.wn8} AS wn8, ${tier.wnx} AS wnx,
      ${players.pr} AS pr, ${players.wtr} AS wtr
    FROM ${tier}
    INNER JOIN ${players} ON ${players.accountId} = ${tier.accountId}
    WHERE ${tier.period} = ${period}
      AND ${tier.battles} >= ${TOP_PLAYERS_MIN_BATTLES[period]}
      AND ${players.lastBattleAt} >= now() - ${sql.raw(`interval '${PERIOD_WINDOW[period]}'`)}
      AND ${players.softDeletedAt} IS NULL`;
}

/**
 * Recompute every recent window's pool for a region and replace its rows in
 * `*_player_period_ratings`.
 *
 * One statement for all three windows and their three tier floors, so an
 * account eligible for several is scored once. The pool is read off
 * `*_player_tier_window_ratings` (see `poolFor`) and every eligible account is
 * stored, languages or not, because the unfiltered recent boards read here too.
 *
 * The languages are the expensive half, so they are carried: an account whose
 * stored inference is younger than `LANGUAGES_TTL` keeps it, and only the
 * rest (up to `inferCap`, oldest first) have their clan history read. The
 * first seed passes `Infinity`, since an empty table has nothing to carry.
 */
export async function recomputePlayerPeriodRatings(
  region: Region,
  inferCap: number = HOURLY_INFER_CAP,
): Promise<number> {
  const table = playerPeriodRatingsByRegion[region];
  const clans = clansByRegion[region];
  const limit = Number.isFinite(inferCap) ? sql`LIMIT ${inferCap}` : sql``;

  // Built, swapped and counted entirely inside Postgres. Shipping ~135,000 EU
  // rows to Node and back was most of the pass (35s against a 4s write), and
  // nothing here needs them in JS. The new pool lands in a temp table first
  // because it reads the previous rows (`prev`) to carry their languages,
  // which the DELETE would otherwise take away from under it. One transaction,
  // so a reader sees the previous hour or this one and never half of each.
  return db.transaction(async (tx) => {
    // JIT off, like the lifetime pass: compiling dwarfs one execution here.
    await tx.execute(sql`SET LOCAL jit = off`);
    await tx.execute(sql`
      CREATE TEMP TABLE next_period_ratings ON COMMIT DROP AS
      WITH pool AS (
        ${sql.join(
          RECENT_PERIODS.map((period) => sql`(${poolFor(region, period)})`),
          sql` UNION ALL `,
        )}
      ),
      prev AS (
        SELECT DISTINCT ON (account_id) account_id, languages, languages_at
        FROM ${table}
        ORDER BY account_id, languages_at DESC NULLS LAST
      ),
      todo AS (
        SELECT a.account_id
        FROM (SELECT DISTINCT account_id FROM pool) a
        LEFT JOIN prev USING (account_id)
        WHERE prev.languages_at IS NULL
          OR prev.languages_at < now() - ${sql.raw(`interval '${LANGUAGES_TTL}'`)}
        ORDER BY prev.languages_at ASC NULLS FIRST
        ${limit}
      ),
      ${languageInferenceCtes(region, sql`SELECT account_id FROM todo`)}
      SELECT p.period, p.min_tier, p.account_id, p.nickname, p.battles, p.wins,
        p.wn7, p.wn8, p.wnx, p.pr, p.wtr,
        COALESCE(
          CASE WHEN t.account_id IS NOT NULL THEN l.languages ELSE prev.languages END,
          '{}'::text[]
        ) AS languages,
        CASE WHEN t.account_id IS NOT NULL THEN now() ELSE prev.languages_at END AS languages_at,
        cl.tag AS clan_tag, cl.color AS clan_color
      FROM pool p
      LEFT JOIN todo t USING (account_id)
      LEFT JOIN langs l USING (account_id)
      LEFT JOIN prev USING (account_id)
      LEFT JOIN ${clans} cl ON cl.id = p.clan_id
    `);
    await tx.delete(table);
    const inserted = await tx.execute(sql`
      INSERT INTO ${table} (
        period, min_tier, account_id, nickname, battles, wins, wn7, wn8, wnx,
        pr, wtr, languages, languages_at, clan_tag, clan_color
      )
      SELECT period, min_tier, account_id, nickname, battles, wins, wn7, wn8, wnx,
        pr, wtr, languages, languages_at, clan_tag, clan_color
      FROM next_period_ratings
    `);
    return inserted.count;
  });
}
