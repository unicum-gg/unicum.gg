"use client";

import { RATING_METRIC_LABEL } from "@unicum.gg/shared";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { RatingFallbackReason } from "@/components/rating-fallback-reason";


/**
 * The line a per-vehicle or per-window surface prints when the reader picked
 * PR or WTR, saying which rating it shows instead and why. Renders nothing for
 * a WN rating, so it can sit in any such surface unconditionally.
 */
export function RatingFallbackNote({
  reason,
  className,
}: {
  reason: RatingFallbackReason;
  className?: string;
}) {
  const { t } = useTranslation("components/rating-fallback-note");
  const { metric, wnMetric, isFallback } = useRatingMetric();
  if (!isFallback) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {t(reason, {
        metric: RATING_METRIC_LABEL[metric],
        shown: RATING_METRIC_LABEL[wnMetric],
      })}
    </p>
  );
}
