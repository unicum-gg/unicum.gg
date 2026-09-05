"use client";

import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_COLOR_CLASS,
  RatingMetric,
  wn8Color,
  wnxColor,
} from "@unicum.gg/shared";
import type { TournamentTeam } from "./record";

/** The metric the reader picked in the top bar, as every table on the site
 * reads it. */
export function useRatingMetric(): RatingMetric {
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  return isRatingMetric(stored) ? stored : DEFAULT_RATING_METRIC;
}

/**
 * A team's average rating on the reader's metric.
 *
 * WN7 has no per-account column, so a reader on it sees WN8, the same fallback
 * the roster table makes.
 *
 * Guarded rather than trusted, even though the type says `number | null`: the
 * endpoint sends `cache-control: max-age=300`, so for five minutes after these
 * fields shipped a page can be handed a payload written before them, and an
 * absent field formats as "NaN" where a missing one should read as a dash.
 */
export function ratingOf(
  team: TournamentTeam,
  metric: RatingMetric,
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
  metric: RatingMetric,
): number | null {
  const value = metric === RatingMetric.Wnx ? team.avgWnx30d : team.avgWn830d;
  return Number.isFinite(value) ? value : null;
}

export function ratingColor(value: number, metric: RatingMetric): string {
  return RATING_COLOR_CLASS[
    metric === RatingMetric.Wnx ? wnxColor(value) : wn8Color(value)
  ];
}

/** Every team's rating, keyed by id, for the views that only hold an id (the
 * bracket names a tie's sides by team id, not by team). */
export function ratingsByTeam(
  teams: TournamentTeam[],
  metric: RatingMetric,
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
