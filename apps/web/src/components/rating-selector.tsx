"use client";

import {
  isRatingMetric,
  isWnRatingMetric,
  RATING_METRIC_LABEL,
  RATING_METRICS,
  WN_RATING_METRICS,
} from "@unicum.gg/shared";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { styles } from "@/lib/styles";
import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RatingSelector() {
  const { t } = useTranslation("components/rating-selector");
  const { metric, setMetric } = useRatingMetric();
  // Ours first, then Wargaming's, under a label each: the two are not the same
  // kind of number (see `RatingMetric`), and the grouping is the one place a
  // reader learns that before a table falls back to WNX on them.
  const wargaming = RATING_METRICS.filter((m) => !isWnRatingMetric(m));

  return (
    <Select
      value={metric}
      // No `router.refresh()`. It used to be here for leaderboards that read
      // the metric from `cookies()` at render time, but no page does anymore:
      // every view renders every variant and gates them on
      // `html[data-rating-metric]` (see `rating-metric-root`), and the tables
      // read the cookie through `useCookie`, which broadcasts the change.
      // The refresh was not free either. Since Next 16 it eagerly re-prefetches
      // every in-viewport link, one request per route segment, so switching
      // metric on /tanks fired 42 extra requests for 2 MB of flight payload.
      onValueChange={(v) => {
        if (!isRatingMetric(v)) return;
        setMetric(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("label")}
        className={styles.navPill}
      >
        <SelectValue>{RATING_METRIC_LABEL[metric]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t("group.community")}</SelectLabel>
          {WN_RATING_METRICS.map((m) => (
            <SelectItem key={m} value={m}>
              {RATING_METRIC_LABEL[m]}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>{t("group.wargaming")}</SelectLabel>
          {wargaming.map((m) => (
            <SelectItem key={m} value={m}>
              {RATING_METRIC_LABEL[m]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
