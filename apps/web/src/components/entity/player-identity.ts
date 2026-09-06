/**
 * Everything the site shows about a player inline: the name, the clan they wear
 * and the crests they have earned.
 *
 * One type rather than a parameter list, because the point is that a caller
 * passes what it HAS and the rendering decides what to show. Every field but
 * the nickname is optional, so a payload that carries no crest data renders a
 * bare name instead of failing to compile, and a payload that gains one later
 * starts showing it with no call-site change.
 */
export type PlayerIdentity = {
  nickname: string;
  /** Needed by the live pill, which resolves itself from the streamers stream.
   * Absent on a row that only knows a name (a roster from an old tournament). */
  accountId?: number | null;
  clanTag?: string | null;
  clanColor?: string | null;
  isVerified?: boolean;
  isSupporter?: boolean;
  /** Twitch login when the account is a streamer; the crest links to it. */
  twitchLogin?: string | null;
  tournamentWins?: number;
  tournamentFeaturedWins?: number;
  tournamentBestTitle?: string | null;
  /** The best Onslaught place ever held: the tier picks the crest's tincture,
   * the rank is what its tooltip names, and the season count separates one good
   * run from a habit. Absent for almost every player. */
  onslaughtBestTier?: string | null;
  onslaughtBestRank?: number | null;
  onslaughtSeasons?: number;
};

/**
 * Read a player identity off an API row.
 *
 * The public API answers in snake_case and the rest of the app is camelCase, so
 * the mapping had been written out at every call site, which is where fields
 * went missing: the clan members table forgot the three tournament ones and
 * showed no winner's crest, while the same account wore it on the home page.
 */
export function identityFromRow(row: {
  nickname: string;
  // Every field is snake_case on purpose. A camelCase row structurally
  // satisfies this shape through the optional fields alone, so it would type
  // check and then silently drop the tag and every crest; callers whose source
  // is already camelCase build the identity literally instead.
  account_id?: number | null;
  clan_tag?: string | null;
  clan_color?: string | null;
  is_verified?: boolean;
  is_supporter?: boolean;
  twitch_login?: string | null;
  tournament_wins?: number;
  tournament_featured_wins?: number;
  tournament_best_title?: string | null;
  onslaught_best_tier?: string | null;
  onslaught_best_rank?: number | null;
  onslaught_seasons?: number;
}): PlayerIdentity {
  return {
    nickname: row.nickname,
    accountId: row.account_id,
    clanTag: row.clan_tag,
    clanColor: row.clan_color,
    isVerified: row.is_verified,
    isSupporter: row.is_supporter,
    twitchLogin: row.twitch_login,
    tournamentWins: row.tournament_wins,
    tournamentFeaturedWins: row.tournament_featured_wins,
    tournamentBestTitle: row.tournament_best_title,
    onslaughtBestTier: row.onslaught_best_tier,
    onslaughtBestRank: row.onslaught_best_rank,
    onslaughtSeasons: row.onslaught_seasons,
  };
}
