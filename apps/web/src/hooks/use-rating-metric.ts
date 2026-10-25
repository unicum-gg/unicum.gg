"use client";

import { useCallback } from "react";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  RatingMetric,
  type WnRatingMetric,
  wnRatingMetric,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

/**
 * The rating metric the reader picked in the navbar, read from the cookie every
 * selector writes and broadcast to every consumer through `useCookie`.
 *
 * `wnMetric` is what a per-vehicle or per-window surface shows instead: the
 * same metric when it is a WN rating, WNX when the reader picked PR or WTR,
 * which are account figures and exist for neither (see `RatingMetric`).
 * `isFallback` says the two differ, which is when such a surface should say
 * why it is not showing what was asked for.
 */
export function useRatingMetric(): {
  metric: RatingMetric;
  wnMetric: WnRatingMetric;
  isFallback: boolean;
  setMetric: (metric: RatingMetric) => void;
} {
  const [stored, setStored] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric = isRatingMetric(stored) ? stored : DEFAULT_RATING_METRIC;
  const wnMetric = wnRatingMetric(metric);
  const setMetric = useCallback(
    (next: RatingMetric) => setStored(next),
    [setStored],
  );
  return { metric, wnMetric, isFallback: wnMetric !== metric, setMetric };
}
