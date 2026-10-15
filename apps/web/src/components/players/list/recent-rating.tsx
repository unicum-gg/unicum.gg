"use client";

import {
  RATING_COLOR_CLASS,
  RATING_METRIC_LABEL,
  RatingMetric,
  wn7Color,
  wn8Color,
  wnxColor,
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

const COLOR_FOR_METRIC: Record<RatingMetric, (v: number) => string> = {
  [RatingMetric.Wn7]: (v) => RATING_COLOR_CLASS[wn7Color(v)],
  [RatingMetric.Wn8]: (v) => RATING_COLOR_CLASS[wn8Color(v)],
  [RatingMetric.Wnx]: (v) => RATING_COLOR_CLASS[wnxColor(v)],
};

/**
 * The heading of a leaderboard's 30-day rating column, printed beside the
 * lifetime one the way the clan members table does, so a career and the form
 * the player is in today read side by side.
 */
export function RecentRatingHead({
  metric,
  className,
  ratingCol,
}: {
  metric: RatingMetric;
  className?: string;
  /** For a board that mounts every metric and lets CSS pick one. */
  ratingCol?: boolean;
}) {
  const { t } = useTranslation("components/players/list/recent-rating");
  const label = RATING_METRIC_LABEL[metric];
  return (
    <TableHead
      data-rating-col={ratingCol ? metric : undefined}
      className={cn("w-24 text-right!", className)}
      title={t("head-hint", { metric: label })}
    >
      {t("head", { metric: label })}
    </TableHead>
  );
}

/** One row's 30-day rating, null when the player has not played inside it. */
export function RecentRatingCell({
  metric,
  value,
  battles,
  className,
  ratingCol,
}: {
  metric: RatingMetric;
  value: number | null | undefined;
  battles: number | null | undefined;
  className?: string;
  /** For a board that mounts every metric and lets CSS pick one. */
  ratingCol?: boolean;
}) {
  const { t } = useTranslation("components/players/list/recent-rating");
  const { num } = useFormat();
  if (value == null) {
    return (
      <TableCell
        data-rating-col={ratingCol ? metric : undefined}
        className={cn("text-right text-muted-foreground tabular-nums", className)}
        title={t("none")}
      >
        —
      </TableCell>
    );
  }
  const count = battles ?? 0;
  const banded = count >= RECENT_MIN_BATTLES;
  return (
    <TableCell
      data-rating-col={ratingCol ? metric : undefined}
      className={cn(
        "text-right font-semibold tabular-nums",
        banded ? COLOR_FOR_METRIC[metric](value) : "text-muted-foreground",
        className,
      )}
      title={t("hint", {
        metric: RATING_METRIC_LABEL[metric],
        battles: num(INT_FORMAT).format(count),
      })}
    >
      {num(INT_FORMAT).format(value)}
    </TableCell>
  );
}
