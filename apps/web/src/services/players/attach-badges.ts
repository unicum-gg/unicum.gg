import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Attach the public `is_verified` / `is_supporter` / tournament flags to a batch of player
 * rows (any object carrying `account_id`) in one pair of indexed lookups
 * against the auth tables. Rows whose account isn't connected on the site keep
 * both flags `false`. Called at the API boundary so the leaderboard/list
 * producers (often cached/materialized) stay free of auth concerns.
 */
export async function attachPlayerBadges<T extends { account_id: number }>(
  region: Region,
  rows: T[],
): Promise<
  (T & {
    is_verified: boolean;
    is_supporter: boolean;
    twitch_login: string | null;
    tournament_wins: number;
    tournament_featured_wins: number;
    tournament_best_title: string | null;
  })[]
> {
  const badges = await resolvePlayerBadges(
    region,
    rows.map((r) => r.account_id),
  );
  return rows.map((row) => {
    const b = badges.get(row.account_id);
    return {
      ...row,
      is_verified: b?.verified ?? false,
      is_supporter: b?.supporter ?? false,
      twitch_login: b?.twitchLogin ?? null,
      tournament_wins: b?.tournamentWins ?? 0,
      tournament_featured_wins: b?.tournamentFeaturedWins ?? 0,
      tournament_best_title: b?.tournamentBestTitle ?? null,
    };
  });
}
