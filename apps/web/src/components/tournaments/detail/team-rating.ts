"use client";

import { useRatingMetric } from "@/hooks/use-rating-metric";
import {
  RATING_COLOR_CLASS,
  RatingMetric,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import type { TournamentTeam } from "./record";

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

/** The rating the tournament views show for the metric the reader picked in
 * the top bar. Its label is what every heading must print, so a reader on WN7
 * is not shown WN8 figures under a WN7 heading. */
export function useTournamentMetric(): TournamentMetric {
  return tournamentMetric(useRatingMetric().metric);
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
