import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
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
 * A row whose account is not connected here keeps the falsy defaults rather
 * than being dropped.
 */

/** The camelCase shape, for payloads built against our own types. */
export type PlayerCrests = {
  isVerified: boolean;
  isSupporter: boolean;
  twitchLogin: string | null;
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
};

/** The snake_case shape, for rows that go out on the public API as they are. */
export type PlayerCrestsSnake = {
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
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
    const c = crests.get(row.account_id) ?? EMPTY;
    return {
      ...row,
      is_verified: c.isVerified,
      is_supporter: c.isSupporter,
      twitch_login: c.twitchLogin,
      tournament_wins: c.tournamentWins,
      tournament_featured_wins: c.tournamentFeaturedWins,
      tournament_best_title: c.tournamentBestTitle,
    };
  });
}
