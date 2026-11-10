import {
  RATING_COLOR_CLASS,
  RatingMetric,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import { TournamentTeamStatus } from "@unicum.gg/wargaming";
import type { TournamentTeam } from "./record";

// Neutral on purpose, like `record` and `team-run` beside it: a team page ranks
// its own roster against the field on the SERVER, so these have to be callable
// from a server component. The reader's own pick lives in
// `@/hooks/use-tournament-metric`, which is the only part of this that needs a
// client.

/** The two ratings a team and its roster carry. */
export type TournamentMetric = RatingMetric.Wn8 | RatingMetric.Wnx;

/**
 * Which of the two a reader's pick is shown as: WN7 reads WN8, the roster
 * table's long-standing fallback, and PR and WTR read WNX, the site's own
 * fallback for a surface that does not carry them (see `RatingMetric`).
 */
export function tournamentMetric(metric: RatingMetric): TournamentMetric {
  return metric === RatingMetric.Wn7 || metric === RatingMetric.Wn8
    ? RatingMetric.Wn8
    : RatingMetric.Wnx;
}

/**
 * A team's average rating on the reader's metric.
 *
 * Takes the metric as `useTournamentMetric` resolves it.
 *
 * Guarded rather than trusted, even though the type says `number | null`: the
 * endpoint sends `cache-control: max-age=300`, so for five minutes after these
 * fields shipped a page can be handed a payload written before them, and an
 * absent field formats as "NaN" where a missing one should read as a dash.
 */
export function ratingOf(
  team: TournamentTeam,
  metric: TournamentMetric,
): number | null {
  const value = metric === RatingMetric.Wnx ? team.avgWnx : team.avgWn8;
  return Number.isFinite(value) ? value : null;
}

/**
 * The same average over the trailing 30 days, which is the roster's form rather
 * than its career.
 *
 * Only meaningful while a tournament is still ahead or in play: the window is
 * the last 30 days from NOW, so on a settled tournament it describes who those
 * players are today, not who turned up on the night, and labelling that as the
 * team's rating would be a claim about a match it was never measured at.
 */
export function recentRatingOf(
  team: TournamentTeam,
  metric: TournamentMetric,
): number | null {
  const value = metric === RatingMetric.Wnx ? team.avgWnx30d : team.avgWn830d;
  return Number.isFinite(value) ? value : null;
}

export function ratingColor(value: number, metric: TournamentMetric): string {
  return RATING_COLOR_CLASS[
    metric === RatingMetric.Wnx ? wnxColor(value) : wn8Color(value)
  ];
}

/** Every team's rating, keyed by id, for the views that only hold an id (the
 * bracket names a tie's sides by team id, not by team). */
export function ratingsByTeam(
  teams: TournamentTeam[],
  metric: TournamentMetric,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const team of teams) {
    const rating = ratingOf(team, metric);
    if (rating !== null) out.set(team.id, rating);
  }
  return out;
}

/** Every team's clan, keyed by id, for the views that only hold an id (a tie
 * names its sides by team id, not by team). */
export function clansByTeam(
  teams: TournamentTeam[],
): Map<number, { tag: string; color: string | null }> {
  const out = new Map<number, { tag: string; color: string | null }>();
  for (const team of teams) {
    if (team.clan) {
      out.set(team.id, { tag: team.clan.clanTag, color: team.clan.clanColor });
    }
  }
  return out;
}

/** Where one team stands in its field on one metric, out of the teams that
 * field holds a rating for. */
export type TeamRatingStanding = {
  /** Null for a team we hold no rating for: it is unmeasured, not last. */
  rank: number | null;
  rated: number;
};

/** A team's standing on both metrics it can be read on, so a header that
 * follows the reader's own pick needs none of the field to print it. */
export type TeamRatingStandings = Record<TournamentMetric, TeamRatingStanding>;

function standingOn(
  teams: TournamentTeam[],
  team: TournamentTeam,
  metric: TournamentMetric,
): TeamRatingStanding {
  // The field is the teams that were actually entered in the bracket. A daily
  // draws far more registrations than it confirms (a 29-team draw took 29 of
  // 44), and a team that never made the minimum roster never played anyone, so
  // ranking against it pads the denominator with teams that were not there. The
  // fallback covers a tournament still forming, where nothing is confirmed yet.
  const entered = teams.filter(
    (t) => t.status === TournamentTeamStatus.Confirmed,
  );
  const field = entered.length > 0 ? entered : teams;
  // Ranked against the teams we can rate, not the whole field: a team with no
  // rated player is not "last", it is unmeasured, and counting it would move
  // everyone else's rank.
  const rated = field
    .map((t) => ratingOf(t, metric))
    .filter((v): v is number => v !== null);
  const rating = ratingOf(team, metric);
  return {
    rank: rating === null ? null : rated.filter((v) => v > rating).length + 1,
    rated: rated.length,
  };
}

/**
 * One team's rank in its field, on each metric, computed where the field is
 * cheap to hold.
 *
 * Both metrics rather than the reader's one, because the pick is a cookie the
 * server does not read on a static page, and two numbers are what spares the
 * client the whole team list. Measured 2026-11-10 on the EU championship
 * 5000000079: `teams` is 3,337,841 octets of a 10,113,923-octet tournament, so
 * handing it to a `"use client"` header to count how many averages beat one of
 * them serialised all of it into the RSC flight data the page's ISR entry
 * stores, 7,647 teams over, once per team page.
 */
export function teamRatingStandings(
  teams: TournamentTeam[],
  team: TournamentTeam,
): TeamRatingStandings {
  return {
    [RatingMetric.Wn8]: standingOn(teams, team, RatingMetric.Wn8),
    [RatingMetric.Wnx]: standingOn(teams, team, RatingMetric.Wnx),
  };
}
