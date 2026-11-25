import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import type { PlayerCrests } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The crests a player wears, attached to a batch of rows in one set of indexed
 * lookups against the auth and streamer tables.
 *
 * Called at the API boundary so the list producers, often materialized or
 * cached, stay free of auth concerns. Two spellings, because the public API
 * answers in snake_case and the payloads written against our own types are
 * camelCase; both read the same resolver, so what they attach cannot drift
 * apart. It had, before this: four hand-rolled copies attached six fields, four
 * fields and three fields respectively, which is how a winner came to wear the
 * crest on one page and nothing on the next.
 *
 * A row whose account is not connected here keeps the camelCase falsy defaults
 * rather than being dropped; the snake_case half omits them, see
 * `PlayerCrestsSnake`.
 */

/**
 * The snake_case shape, for rows that go out on the public API as they are.
 *
 * Every field is optional and a crest nobody wears is OMITTED rather than
 * written as `false`, `null` or `0`. On one row that is pedantry, on a
 * leaderboard it is most of the payload: measured on the EU board, these nine
 * fields were 1,014,661 of the 2,226,634 bytes a navigation carried, and nearly
 * all of them empty (4,999 rows of 5,000 said `is_supporter: false`, 4,867 said
 * `twitch_login: null`, and `tournament_best_title` spent 177 kB saying players
 * hold no title, against 125 kB for every nickname on the board). The response
 * schemas have always declared them optional, so an absent field reads exactly
 * as the falsy one did for anything testing it.
 */
export type PlayerCrestsSnake = {
  is_verified?: boolean;
  is_supporter?: boolean;
  twitch_login?: string;
  tournament_wins?: number;
  tournament_featured_wins?: number;
  tournament_best_title?: string;
  onslaught_best_tier?: string;
  onslaught_best_rank?: number;
  onslaught_seasons?: number;
};

async function crestsFor(
  region: Region,
  ids: number[],
): Promise<Map<number, PlayerCrests>> {
  const badges = await resolvePlayerBadges(region, ids);
  const out = new Map<number, PlayerCrests>();
  for (const [id, b] of badges) {
    out.set(id, {
      isVerified: b.verified,
      isSupporter: b.supporter,
      twitchLogin: b.twitchLogin,
      tournamentWins: b.tournamentWins,
      tournamentFeaturedWins: b.tournamentFeaturedWins,
      tournamentBestTitle: b.tournamentBestTitle,
      onslaughtBestTier: b.onslaughtBestTier,
      onslaughtBestRank: b.onslaughtBestRank,
      onslaughtSeasons: b.onslaughtSeasons,
    });
  }
  return out;
}

const EMPTY: PlayerCrests = {
  isVerified: false,
  isSupporter: false,
  twitchLogin: null,
  tournamentWins: 0,
  tournamentFeaturedWins: 0,
  tournamentBestTitle: null,
  onslaughtBestTier: null,
  onslaughtBestRank: null,
  onslaughtSeasons: 0,
};

/** Attach to rows keyed by a camelCase `accountId`. */
export async function attachPlayerCrests<T extends { accountId: number }>(
  region: Region,
  rows: T[],
): Promise<(T & PlayerCrests)[]> {
  if (rows.length === 0) return [];
  const crests = await crestsFor(
    region,
    rows.map((r) => r.accountId),
  );
  return rows.map((row) => ({ ...row, ...(crests.get(row.accountId) ?? EMPTY) }));
}

/** Attach to rows keyed by a snake_case `account_id`, in snake_case. */
export async function attachPlayerBadges<T extends { account_id: number }>(
  region: Region,
  rows: T[],
): Promise<(T & PlayerCrestsSnake)[]> {
  if (rows.length === 0) return [];
  const crests = await crestsFor(
    region,
    rows.map((r) => r.account_id),
  );
  return rows.map((row) => {
    const c = crests.get(row.account_id);
    if (!c) return row as T & PlayerCrestsSnake;
    const out: T & PlayerCrestsSnake = { ...row };
    if (c.isVerified) out.is_verified = true;
    if (c.isSupporter) out.is_supporter = true;
    if (c.twitchLogin) out.twitch_login = c.twitchLogin;
    if (c.tournamentWins) out.tournament_wins = c.tournamentWins;
    if (c.tournamentFeaturedWins)
      out.tournament_featured_wins = c.tournamentFeaturedWins;
    if (c.tournamentBestTitle) out.tournament_best_title = c.tournamentBestTitle;
    if (c.onslaughtBestTier) out.onslaught_best_tier = c.onslaughtBestTier;
    if (c.onslaughtBestRank) out.onslaught_best_rank = c.onslaughtBestRank;
    if (c.onslaughtSeasons) out.onslaught_seasons = c.onslaughtSeasons;
    return out;
  });
}
