/**
 * The crests a player wears beside their name, as the payloads written against
 * our own types carry them (camelCase).
 *
 * **This is the one list of them.** Every surface that draws a player's name
 * takes its crests from here through `crestsOf`, rather than spelling the
 * fields out at the call site. Spelled out, a crest added later had to be added
 * at every table by hand, and twice it was not: the clan roster wore no
 * winner's crest while the home leaderboard did, then no Onslaught crest while
 * the profile did, with the server sending both the whole time.
 */
export type PlayerCrests = {
  /** The owner connected this WoT account on the site. */
  isVerified: boolean;
  /** An active, non-anonymous supporter. */
  isSupporter: boolean;
  /** Twitch login when the account is a streamer; the crest links to it. */
  twitchLogin: string | null;
  /** Tournaments won, the featured ones counted apart, and the win worth
   * naming in the tooltip. */
  tournamentWins: number;
  tournamentFeaturedWins: number;
  tournamentBestTitle: string | null;
  /** The best Onslaught place ever held: the tier picks the tincture, the rank
   * is what the tooltip names, and the season count separates one good run
   * from a habit. */
  onslaughtBestTier: string | null;
  onslaughtBestRank: number | null;
  onslaughtSeasons: number;
};

/** The crest fields as a row may carry them: any of them absent. */
export type PlayerCrestFields = Partial<PlayerCrests>;

// A record rather than an array so the compiler refuses it the moment a crest
// is added to the type and not here, which is what lets `crestsOf` stand in
// for every hand-written list.
const CREST_FIELDS: Record<keyof PlayerCrests, true> = {
  isVerified: true,
  isSupporter: true,
  twitchLogin: true,
  tournamentWins: true,
  tournamentFeaturedWins: true,
  tournamentBestTitle: true,
  onslaughtBestTier: true,
  onslaughtBestRank: true,
  onslaughtSeasons: true,
};

export const PLAYER_CREST_KEYS = Object.keys(CREST_FIELDS) as (keyof PlayerCrests)[];

/** The crests a row carries, and nothing else from it. */
export function crestsOf(row: PlayerCrestFields): PlayerCrestFields {
  const out: Record<string, unknown> = {};
  for (const key of PLAYER_CREST_KEYS) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out as PlayerCrestFields;
}
