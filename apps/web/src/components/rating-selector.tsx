"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      onValueChange={(v) => {
        if (!isRatingMetric(v)) return;
        setStored(v);
        // Re-fetch any RSC that reads the cookie (homepage leaderboards
        // pick the metric from cookies() at render time). Pages that only
        // rely on CSS data-attributes ignore this no-op.
        router.refresh();
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
