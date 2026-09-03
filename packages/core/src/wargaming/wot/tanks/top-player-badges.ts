import { resolvePlayerBadges } from "@unicum.gg/core/players/badges";
import { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TopTankPlayersByMetric } from "@unicum.gg/core/wargaming/wot/players/top/by-tank";

/**
 * Attach the crests to a tank's three metric leaderboards.
 *
 * One resolve for all three rather than one each: the same accounts appear
 * across them (a player near the top on WN8 is usually near it on WNX), so the
 * board-by-board version would ask for most ids three times.
 *
 * Fields are snake_case to match the rows they join, which is what the client's
 * `identityFromRow` reads. Every one is optional there, so an entry written
 * before this existed renders a bare name rather than failing.
 *
 * Kept in core rather than sharing the web's `attachPlayerBadges`: this runs
 * inside `assembleTankDetail`, which the worker's warm cron calls too, and core
 * cannot import from the web app. The mapping is the same and both read
 * `resolvePlayerBadges`, so the two cannot disagree about what a crest is.
 */
/** What the attachment adds, so the rows carry it in the type as well as at
 * runtime. Without this the consumer's `identityFromRow` compiles either way
 * and the crests could vanish on a rename with a green build. */
type WithBadges<T> = T & {
  is_verified: boolean;
  is_supporter: boolean;
  twitch_login: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
};

export type TopTankPlayersWithBadges = Omit<
  TopTankPlayersByMetric,
  RatingMetric.Wn7 | RatingMetric.Wn8 | RatingMetric.Wnx
> & {
  [RatingMetric.Wn7]: WithBadges<TopTankPlayersByMetric[RatingMetric.Wn7][number]>[];
  [RatingMetric.Wn8]: WithBadges<TopTankPlayersByMetric[RatingMetric.Wn8][number]>[];
  [RatingMetric.Wnx]: WithBadges<TopTankPlayersByMetric[RatingMetric.Wnx][number]>[];
};

export async function withPlayerBadges(
  region: Region,
  top: TopTankPlayersByMetric,
): Promise<TopTankPlayersWithBadges> {
  const boards = [RatingMetric.Wn7, RatingMetric.Wn8, RatingMetric.Wnx] as const;
  const ids = boards.flatMap((m) => top[m].map((p) => p.account_id));
  if (ids.length === 0) return top as TopTankPlayersWithBadges;
  const badges = await resolvePlayerBadges(region, ids);
  const decorate = (rows: TopTankPlayersByMetric[RatingMetric.Wn7]) =>
    rows.map((row) => {
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
  return {
    ...top,
    [RatingMetric.Wn7]: decorate(top[RatingMetric.Wn7]),
    [RatingMetric.Wn8]: decorate(top[RatingMetric.Wn8]),
    [RatingMetric.Wnx]: decorate(top[RatingMetric.Wnx]),
  };
}
