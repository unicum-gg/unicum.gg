"use client";

import { useEffect } from "react";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
} from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";

/**
 * Mirrors the selected rating metric onto `html[data-rating-metric]` so the
 * site can react via plain CSS (highlight one row in the player stats
 * table, hide two of three columns in the clan members table, swap the
 * value shown in the clan header). No table needs to be a Client Component
 * just to read the cookie.
 *
 * The initial value is also painted server-side from the cookie inside the
 * root layout, so the first client render does not flash the default.
 */
export function RatingMetricRoot() {
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric = isRatingMetric(stored) ? stored : DEFAULT_RATING_METRIC;
  useEffect(() => {
    document.documentElement.dataset.ratingMetric = metric;
  }, [metric]);
  return null;
}
