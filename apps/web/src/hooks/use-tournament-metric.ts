"use client";

import {
  tournamentMetric,
  type TournamentMetric,
} from "@/components/tournaments/detail/team-rating";
import { useRatingMetric } from "@/hooks/use-rating-metric";

/**
 * The rating the tournament views show for the metric the reader picked in the
 * top bar. Its label is what every heading must print, so a reader on WN7 is
 * not shown WN8 figures under a WN7 heading.
 *
 * Here rather than beside `tournamentMetric`, which it wraps, so that module
 * can stay neutral: a team's rank in its field is computed on the server, and a
 * server component importing anything from a `"use client"` module is handed a
 * client REFERENCE rather than the function, which fails silently.
 */
export function useTournamentMetric(): TournamentMetric {
  return tournamentMetric(useRatingMetric().metric);
}
