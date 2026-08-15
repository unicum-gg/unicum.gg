"use client";

import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
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
}: {
  className?: string;
}) {
  const [stored, setStored] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric: RatingMetric = isRatingMetric(stored)
    ? stored
    : DEFAULT_RATING_METRIC;

  return (
    <Select
      value={metric}
      // See `rating-selector` for why there is no `router.refresh()` here.
      onValueChange={(v) => {
        if (!isRatingMetric(v)) return;
        setStored(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Rating metric"
        className={className ?? DEFAULT_TRIGGER_CLASS}
      >
        <SelectValue>{RATING_METRIC_LABEL[metric]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {RATING_METRICS.map((m) => (
          <SelectItem key={m} value={m}>
            {RATING_METRIC_LABEL[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
