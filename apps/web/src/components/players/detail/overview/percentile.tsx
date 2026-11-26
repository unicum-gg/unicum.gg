"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import useSWR from "swr";
import {
  type DistributionBucket,
  type PlayerDistribution,
  percentileOf,
  RATING_COLOR_HEX,
  RATING_COLOR_OF,
  RATING_METRIC_LABEL,
  RatingMetric,
  type WnRatingMetric,
  winrateColor,
} from "@unicum.gg/shared";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import { Interpolate } from "@/components/interpolate";
import { PeriodInlineSelect } from "@/components/period-inline-select";
import { Period, usePeriod } from "@/hooks/use-period";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";

/**
 * Where this account sits against everyone else on its server.
 *
 * The region's histograms are materialised hourly for the servers page, so
 * situating one player is arithmetic over a payload that already exists rather
 * than a query of its own. Fetched client-side and rendered only once it lands:
 * the page's own data does not depend on it, and a player's stats must not wait
 * on an aggregate about everybody else.
 *
 * A select inside the footnote switches to the last 30 days, situated against
 * the players still active, because a career figure lags years behind how
 * someone plays now: a player who has improved reads as average, one who has
 * slipped reads as a top player they no longer feel like. In the sentence that
 * already names the population, as the home boards put their metric picker,
 * so the switch costs the panel no height. Only offered once the window clears
 * the aggregate's own battle floor, so a lucky week of ten games is never
 * ranked. It reads and writes the leaderboards' period cookie, so the window a
 * reader picked on the home boards is the one players are situated on.
 */
const STANDING_PERIODS = [Period.Overall, Period.Month];

export function PlayerPercentile({
  region,
  winrate,
  ratings,
  recent,
}: {
  region: Region;
  /** Lifetime win rate, 0..1. */
  winrate: number | null;
  /** The account's lifetime value for each rating metric, so the panel can
   * follow the one the reader picked rather than naming one for them. */
  ratings: Record<RatingMetric, number | null>;
  /** The profile's 30-day column, as its stats table prints it. */
  recent: {
    battles: number;
    /** 0..1, null with no battles in the window. */
    winrate: number | null;
    ratings: Record<WnRatingMetric, number | null>;
  };
}) {
  const { locale } = useLocale();
  const { t } = useTranslation(
    "components/players/detail/overview/percentile",
  );
  // The same cookie the navbar selector writes.
  const { metric, wnMetric } = useRatingMetric();
  // The leaderboards' Overall / last-30-days cookie: a reader who ranks the home
  // boards on the month reads players on the month too, and switching here
  // switches there.
  const [period, setPeriod] = usePeriod();
  const rating = ratings[metric] ?? null;
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

  const career = standings(data.winrate, data.ratings[metric] ?? [], {
    winrateLabel: t("win-rate"),
    winrate,
    metric,
    rating,
  });
  // A window is a different population with its own floor, and PR or WTR have
  // no 30-day value at all, so it shows the WN rating the reader falls back to
  // there, exactly as the stats table's 30-day column does.
  const recentRows =
    data.recent && recent.battles >= data.recent.minBattles
      ? standings(data.recent.winrate, data.recent.ratings[wnMetric] ?? [], {
          winrate: recent.winrate,
          metric: wnMetric,
          rating: recent.ratings[wnMetric] ?? null,
          winrateLabel: t("win-rate"),
        })
      : [];

  if (career.length === 0) return null;

  const offerRecent = recentRows.length > 0 && data.recent !== null;
  const showRecent = offerRecent && period === Period.Month;
  const entries = showRecent ? recentRows : career;
  const population = showRecent && data.recent ? data.recent : data;
  const footnoteValues = {
    players: numberFormat(locale).format(population.players),
    region: REGION_LABEL[region],
    battles: population.minBattles,
  };

  return (
    // The separating rule belongs to this component rather than to the wrapper
    // in the overview: the panel must not carry a hanging line while there is
    // nothing under it, which is every player page's first paint and every
    // region whose hourly aggregate has not run.
    <div className="space-y-3 border-t border-fd-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.kind} className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wide text-fd-muted-foreground">
              {t("versus", { metric: entry.label, region: REGION_LABEL[region] })}
            </div>
            <div className="text-xl font-semibold" style={{ color: entry.color }}>
              {formatStanding(entry.percentile, t)}
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
        {offerRecent ? (
          <Interpolate
            template={t(
              showRecent ? "against-recent" : "against-career",
              footnoteValues,
            )}
            values={{
              window: (
                <PeriodInlineSelect
                  period={period}
                  periods={STANDING_PERIODS}
                  label={(p) => t(p === Period.Overall ? "career" : "recent")}
                  onChange={setPeriod}
                  ariaLabel={t("window")}
                  className="my-0 h-6! gap-1 px-1.5! text-xs! font-normal [&_svg]:size-3"
                />
              ),
            }}
          />
        ) : (
          t("against", footnoteValues)
        )}
      </p>
    </div>
  );
}

enum StandingKind {
  Winrate = "winrate",
  Rating = "rating",
}

type Standing = {
  kind: StandingKind;
  label: string;
  percentile: number;
  color: string;
};

/** The win rate and the rating situated against one population's histograms,
 * leaving out whatever the player has no value for. */
function standings(
  winrateBuckets: DistributionBucket[],
  ratingBuckets: DistributionBucket[],
  player: {
    winrateLabel: string;
    winrate: number | null;
    metric: RatingMetric;
    rating: number | null;
  },
): Standing[] {
  const winrate = player.winrate;
  const rating = player.rating;
  return [
    winrate == null
      ? null
      : {
          kind: StandingKind.Winrate,
          label: player.winrateLabel,
          percentile: percentileOf(winrateBuckets, winrate),
          color: RATING_COLOR_HEX[winrateColor(winrate)],
        },
    rating == null
      ? null
      : {
          kind: StandingKind.Rating,
          label: RATING_METRIC_LABEL[player.metric],
          percentile: percentileOf(ratingBuckets, rating),
          color: RATING_COLOR_HEX[RATING_COLOR_OF[player.metric](rating)],
        },
  ].filter((e) => e !== null && e.percentile !== null) as Standing[];
}

/**
 * A percentile said the way a player would say it.
 *
 * Above the middle it reads as "top N%", which is the phrasing every ranking on
 * the site and in the game uses; below it stays a plain percentile rather than
 * inverting into "bottom N%", which no one wants to read about themselves and
 * which says the same thing twice.
 */
function formatStanding(
  percentile: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const top = (1 - percentile) * 100;
  if (percentile >= 0.5) {
    return t("top", { percent: top < 1 ? top.toFixed(1) : Math.round(top) });
  }
  return t("ahead-of", { percent: Math.round(percentile * 100) });
}
