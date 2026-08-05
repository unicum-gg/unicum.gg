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

export function RatingSelector() {
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
      // No `router.refresh()`. It used to be here for leaderboards that read
      // the metric from `cookies()` at render time, but no page does anymore:
      // every view renders the three variants and gates them on
      // `html[data-rating-metric]` (see `rating-metric-root`), and the tables
      // read the cookie through `useCookie`, which broadcasts the change.
      // The refresh was not free either. Since Next 16 it eagerly re-prefetches
      // every in-viewport link, one request per route segment, so switching
      // metric on /tanks fired 42 extra requests for 2 MB of flight payload.
      onValueChange={(v) => {
        if (!isRatingMetric(v)) return;
        setStored(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Rating metric"
        className="h-8 w-fit gap-1.5 rounded-full border-fd-border bg-fd-secondary/50 px-2.5 text-xs font-medium uppercase"
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
