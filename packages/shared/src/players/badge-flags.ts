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
};
