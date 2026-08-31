"use client";

import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  type PlayerDistribution,
  RATING_COLOR_OF,
  RATING_METRIC_LABEL,
  RatingMetric,
  winrateColor,
} from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { REGION_LABEL, type Region } from "@unicum.gg/wargaming";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { DistributionChart } from "./distribution-chart";
import { formatPlayers } from "./format";

const formatWinrate = (value: number) => `${Math.round(value * 100)}%`;
const formatRating = (value: number) => String(Math.round(value));

/**
 * How the region's players are spread across the two scales the site ranks them
 * on: their win rate, and whichever rating metric the reader has chosen.
 *
 * Both are drawn rather than put behind a switch of this panel's own. Win rate
 * needs no configuration and everyone reads it, while the rating is a
 * preference the reader already expressed in the navbar; a local toggle would
 * have been a third control saying what those two already say.
 */
export function DistributionPanel({
  distribution,
  region,
}: {
  distribution: PlayerDistribution;
  region: Region;
}) {
  // The same cookie the navbar selector writes, so the histogram follows the
  // metric chosen anywhere on the site rather than keeping its own idea of one.
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric: RatingMetric = isRatingMetric(stored)
    ? stored
    : DEFAULT_RATING_METRIC;
  const ratingBuckets = distribution.ratings[metric] ?? [];

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>How {REGION_LABEL[region]} players compare</PanelTitle>
      </PanelHeader>
      {/* No padding on the panel: each section carries its own, so its heading
          rule runs edge to edge like the panel's own does. */}
      <PanelContent className="p-0">
        <Series
          title="Win rate"
          median={medianOf(distribution.winrate)}
          format={formatWinrate}
        >
          <DistributionChart
            buckets={distribution.winrate}
            colorOf={winrateColor}
            formatEdge={formatWinrate}
            ariaLabel="Win rate distribution across the region's tracked players"
          />
        </Series>

        <Series
          title={
            <>
              <RatingMetricInlineSelect /> rating
            </>
          }
          median={medianOf(ratingBuckets)}
          format={formatRating}
        >
          <DistributionChart
            buckets={ratingBuckets}
            colorOf={RATING_COLOR_OF[metric]}
            formatEdge={formatRating}
            ariaLabel={`${RATING_METRIC_LABEL[metric]} distribution across the region's tracked players`}
          />
        </Series>

        <p className="p-4 text-sm text-fd-muted-foreground">
          {formatPlayers(distribution.players)} tracked accounts with at least{" "}
          {formatPlayers(distribution.minBattles)} battles. The colours are the
          same bands the site uses everywhere else.
        </p>
      </PanelContent>
    </Panel>
  );
}

/**
 * One histogram under its own heading.
 *
 * A real `h3` rather than a styled line of text: the panel holds two
 * independent series, and they are sections of it, so the page outline should
 * say so. The median rides beside the heading instead of inside it, since it is
 * a figure about the section rather than part of its name.
 */
function Series({
  title,
  median,
  format,
  children,
}: {
  title: React.ReactNode;
  median: number | null;
  format: (value: number) => string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-fd-border">
      {/* The panel's own shape one level down: a heading band closed by a rule,
          then the content under it. Same grammar, lighter weight, so a section
          reads as part of the panel rather than as a panel of its own. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-fd-border px-4 py-2.5">
        <PanelTitle as="h3" className="text-base">
          {title}
        </PanelTitle>
        {median === null ? null : (
          <span className="text-sm text-fd-muted-foreground">
            median{" "}
            <span className="font-medium tabular-nums text-fd-foreground">
              {format(median)}
            </span>
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** The value half the population sits below, interpolated inside the bucket
 * that straddles it. Read off the histogram itself rather than stored beside
 * it, so it can never disagree with the bars under it. */
function medianOf(
  buckets: { from: number; to: number; count: number }[],
): number | null {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return null;
  let seen = 0;
  for (const bucket of buckets) {
    if (seen + bucket.count >= total / 2) {
      const into = (total / 2 - seen) / (bucket.count || 1);
      return bucket.from + (bucket.to - bucket.from) * into;
    }
    seen += bucket.count;
  }
  return null;
}
