"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
  WN_RATING_METRICS,
  isRatingMetric,
} from "@unicum.gg/shared";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Default: a tiny inline chip that blends into surrounding `text-xs` prose. Pass
// `className` to fully restyle the trigger for a larger context (e.g. a
// `text-xl` panel title, like the home page's period select).
const DEFAULT_TRIGGER_CLASS =
  "inline-flex! h-6! gap-1 px-1.5! py-0! align-middle text-xs [&_svg]:size-3";

export function RatingMetricInlineSelect({
  className,
  wnOnly = false,
}: {
  className?: string;
  /**
   * For a surface that rates a vehicle or a window, where PR and WTR do not
   * exist (see `RatingMetric`): offers the three WN ratings only and shows the
   * one actually displayed, which is WNX for a reader who picked PR or WTR.
   * Without it the chip would name a rating the figure beside it is not.
   */
  wnOnly?: boolean;
}) {
  const { t } = useTranslation("components/rating-metric-inline-select");
  const { metric, wnMetric, setMetric } = useRatingMetric();
  const shown = wnOnly ? wnMetric : metric;
  const options: RatingMetric[] = wnOnly ? WN_RATING_METRICS : RATING_METRICS;

  return (
    <Select
      // The reader's own pick, not the one shown: on a `wnOnly` surface a PR
      // reader sees WNX, and a value of WNX would make clicking WNX a no-op, so
      // that reader could never actually switch to it from here. The trigger
      // prints `shown` either way.
      value={metric}
      // See `rating-selector` for why there is no `router.refresh()` here.
      onValueChange={(v) => {
        if (!isRatingMetric(v)) return;
        setMetric(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("rating-metric")}
        className={className ?? DEFAULT_TRIGGER_CLASS}
      >
        <SelectValue>{RATING_METRIC_LABEL[shown]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((m) => (
          <SelectItem key={m} value={m}>
            {RATING_METRIC_LABEL[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
