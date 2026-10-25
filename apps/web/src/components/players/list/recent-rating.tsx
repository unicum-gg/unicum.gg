"use client";

import {
  RATING_METRIC_LABEL,
  RatingMetric,
  ratingColorClass,
  wnRatingMetric,
} from "@unicum.gg/shared";
import { TableCell, TableHead } from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/**
 * Battles under which a 30-day rating is printed without its colour band.
 *
 * The figure is still shown, since it is what the reader asked for, but a
 * dozen battles can put anyone in the top band, and painting that purple beside
 * a career that earned its colour over twenty thousand would say the two mean
 * the same thing. The tooltip carries the count either way.
 */
const RECENT_MIN_BATTLES = 100;

/**
 * The heading of a leaderboard's 30-day rating column, printed beside the
 * lifetime one the way the clan members table does, so a career and the form
 * the player is in today read side by side.
 *
 * `metric` is the BOARD's metric, which is what the column is gated on. What it
 * prints is `wnRatingMetric(metric)`: a PR or WTR board has no 30-day figure
 * (see `RatingMetric`), so its column carries WNX and its heading says so.
 */
export function RecentRatingHead({
  metric,
  className,
  ratingCol,
  wnCol,
}: {
  metric: RatingMetric;
  className?: string;
  /** For a board that mounts every metric and lets CSS pick one. */
  ratingCol?: boolean;
  /** For a table that mounts this column once per WN metric only, gated on
   * the reader's WN fallback (`data-rating-wn-col`) rather than on their pick. */
  wnCol?: boolean;
}) {
  const { t } = useTranslation("components/players/list/recent-rating");
  const shown = wnRatingMetric(metric);
  const label = RATING_METRIC_LABEL[shown];
  return (
    <TableHead
      data-rating-col={ratingCol ? metric : undefined}
      data-rating-wn-col={wnCol ? metric : undefined}
      className={cn("w-24 text-right!", className)}
      title={
        shown === metric
          ? t("head-hint", { metric: label })
          : t("head-hint-fallback", {
              metric: RATING_METRIC_LABEL[metric],
              shown: label,
            })
      }
    >
      {t("head", { metric: label })}
    </TableHead>
  );
}

/** One row's 30-day rating, null when the player has not played inside it.
 * WNX on a PR or WTR board, for the reason the heading gives. */
export function RecentRatingCell({
  metric,
  value,
  battles,
  className,
  ratingCol,
  wnCol,
}: {
  metric: RatingMetric;
  value: number | null | undefined;
  battles: number | null | undefined;
  className?: string;
  /** For a board that mounts every metric and lets CSS pick one. */
  ratingCol?: boolean;
  /** See `RecentRatingHead`. */
  wnCol?: boolean;
}) {
  const { t } = useTranslation("components/players/list/recent-rating");
  const { num } = useFormat();
  if (value == null) {
    return (
      <TableCell
        data-rating-col={ratingCol ? metric : undefined}
        data-rating-wn-col={wnCol ? metric : undefined}
        className={cn("text-right text-muted-foreground tabular-nums", className)}
        title={t("none")}
      >
        —
      </TableCell>
    );
  }
  const count = battles ?? 0;
  const banded = count >= RECENT_MIN_BATTLES;
  const shown = wnRatingMetric(metric);
  return (
    <TableCell
      data-rating-col={ratingCol ? metric : undefined}
      data-rating-wn-col={wnCol ? metric : undefined}
      className={cn(
        "text-right font-semibold tabular-nums",
        banded ? ratingColorClass(shown, value) : "text-muted-foreground",
        className,
      )}
      title={t("hint", {
        metric: RATING_METRIC_LABEL[shown],
        battles: num(INT_FORMAT).format(count),
      })}
    >
      {num(INT_FORMAT).format(value)}
    </TableCell>
  );
}
