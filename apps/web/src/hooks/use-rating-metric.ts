"use client";

import { useCallback, useSyncExternalStore } from "react";
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

/**
 * The rating metric as the document is PAINTED with it, read synchronously.
 *
 * `useRatingMetric` above reads the cookie through `useCookie`, which answers
 * with the default on its first render and corrects in an effect. That is right
 * for a value only CSS ever acts on, and useless for one that decides what to
 * RENDER: on a client navigation the first render is the one that builds the
 * tree, so a board chosen from it would be the default reader's board every
 * time, for everybody.
 *
 * `html[data-rating-metric]` is the same pick, written before first paint by
 * `INITIAL_METRIC_SCRIPT` in `components/document` and kept current by
 * `RatingMetricRoot`, so it is already correct when that first render runs.
 *
 * `whenUnpainted` is what the server renders with and what hydration is checked
 * against, so pass the metric the markup was BUILT with. It is not politeness:
 * `useSyncExternalStore` re-renders when its client snapshot disagrees with its
 * server one, so answering null here makes every reader on the default metric
 * pay a full re-render of the board right after hydrating it, for a value that
 * never changed.
 */
export function usePaintedRatingMetric(whenUnpainted: RatingMetric): RatingMetric {
  const serverSnapshot = useCallback(() => whenUnpainted, [whenUnpainted]);
  const snapshot = useCallback(
    () => readPainted() ?? whenUnpainted,
    [whenUnpainted],
  );
  return useSyncExternalStore(subscribePainted, snapshot, serverSnapshot);
}

function readPainted(): RatingMetric | null {
  const painted = document.documentElement.dataset.ratingMetric ?? "";
  return isRatingMetric(painted) ? painted : null;
}

function subscribePainted(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-rating-metric"],
  });
  return () => observer.disconnect();
}
