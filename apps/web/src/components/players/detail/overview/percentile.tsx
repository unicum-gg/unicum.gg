"use client";

import useSWR from "swr";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  type PeriodValues,
  type PlayerDistribution,
  percentileOf,
  RATING_COLOR_HEX,
  RATING_COLOR_OF,
  RATING_METRIC_LABEL,
  RatingMetric,
  winrateColor,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { unicum } from "@/services/sdk";

/**
 * Where this account sits against everyone else on its server.
 *
 * The region's histograms are materialised hourly for the servers page, so
 * situating one player is arithmetic over a payload that already exists rather
 * than a query of its own. Fetched client-side and rendered only once it lands:
 * the page's own data does not depend on it, and a player's stats must not wait
 * on an aggregate about everybody else.
 */
export function PlayerPercentile({
  region,
  winrate,
  ratings,
}: {
  region: Region;
  /** Lifetime win rate, 0..1. */
  winrate: number | null;
  /** The account's lifetime value for each rating metric, so the panel can
   * follow the one the reader picked rather than naming one for them. */
  ratings: Record<RatingMetric, PeriodValues>;
}) {
  // The same cookie the navbar selector writes.
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric: RatingMetric = isRatingMetric(stored)
    ? stored
    : DEFAULT_RATING_METRIC;
  const rating = ratings[metric]?.total ?? null;
  const { data } = useSWR(
    `player-distribution:${region}`,
    async () =>
      (await unicum
        .region(region)
        .players.distribution()) as unknown as PlayerDistribution,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      // The aggregate moves once an hour, so a tab left open all afternoon has
      // no reason to ask again.
      dedupingInterval: 3_600_000,
      shouldRetryOnError: false,
    },
  );

  if (!data) return null;

  const entries = [
    winrate == null
      ? null
      : {
          label: "Win rate",
          percentile: percentileOf(data.winrate, winrate),
          color: RATING_COLOR_HEX[winrateColor(winrate)],
        },
    rating == null
      ? null
      : {
          label: RATING_METRIC_LABEL[metric],
          percentile: percentileOf(data.ratings[metric] ?? [], rating),
          color: RATING_COLOR_HEX[RATING_COLOR_OF[metric](rating)],
        },
  ].filter((e) => e !== null && e.percentile !== null) as {
    label: string;
    percentile: number;
    color: string;
  }[];

  if (entries.length === 0) return null;

  return (
    // The separating rule belongs to this component rather than to the wrapper
    // in the overview: the panel must not carry a hanging line while there is
    // nothing under it, which is every player page's first paint and every
    // region whose hourly aggregate has not run.
    <div className="space-y-3 border-t border-fd-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.label} className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              {entry.label} vs {REGION_LABEL[region]}
            </div>
            <div className="text-xl font-semibold" style={{ color: entry.color }}>
              {formatStanding(entry.percentile)}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fd-border/40">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${entry.percentile * 100}%`,
                  backgroundColor: entry.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-fd-muted-foreground">
        Against {new Intl.NumberFormat("en-US").format(data.players)} tracked{" "}
        {REGION_LABEL[region]} accounts with at least {data.minBattles} battles.
      </p>
    </div>
  );
}

/**
 * A percentile said the way a player would say it.
 *
 * Above the middle it reads as "top N%", which is the phrasing every ranking on
 * the site and in the game uses; below it stays a plain percentile rather than
 * inverting into "bottom N%", which no one wants to read about themselves and
 * which says the same thing twice.
 */
function formatStanding(percentile: number): string {
  const top = (1 - percentile) * 100;
  if (percentile >= 0.5) {
    return `Top ${top < 1 ? top.toFixed(1) : Math.round(top)}%`;
  }
  return `Ahead of ${Math.round(percentile * 100)}%`;
}
