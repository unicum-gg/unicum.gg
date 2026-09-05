/**
 * Optional public badge flags attached to a player list/leaderboard row at the
 * API boundary (resolved server-side by core's `resolvePlayerBadges`).
 * Snake_case to match the row payload convention; absent means "not applicable"
 * (treated as false). The live/streamer pill is not here: it self-resolves
 * client-side from the shared streamers stream.
 */
export type PlayerBadgeFlags = {
  /** The owner connected this WoT account on the site (verified badge). */
  is_verified?: boolean;
  /** The account belongs to an active, non-anonymous supporter. */
  is_supporter?: boolean;
  /** The Twitch login of the account's linked channel (a streamer, live or
   * not); present means "is a streamer". Null/absent when not. */
  twitch_login?: string | null;
  /** Tournaments this account was on the winning roster of, with the featured
   * ones counted apart: a nightly gold ladder and a branded championship are
   * the same word and not the same achievement. */
  tournament_wins?: number;
  tournament_featured_wins?: number;
  /** The win worth naming in the crest's tooltip. */
  tournament_best_title?: string | null;
};
