"use client";

import { useRouter } from "next/navigation";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RATING_METRIC_LABEL,
  RATING_METRICS,
  RatingMetric,
} from "@/constants/rating";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RatingMetricInlineSelect() {
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
        router.refresh();
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Rating metric"
        className="inline-flex! h-6! gap-1 px-1.5! py-0! align-middle text-xs [&_svg]:size-3"
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
