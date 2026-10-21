"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_TIER_FLOOR, type TierFloor, parseTierFloor } from "@unicum.gg/shared";
import { createParamStore } from "@/lib/url-param-store";

/**
 * The tier floor a recent player board counts battles from, in `?tier=`.
 *
 * The URL rather than a cookie like the period beside it, because the floor
 * is a reading of one board rather than a preference the rest of the site
 * follows, and a link to the tier X board has to open on it. The panel and
 * the intro sentence above it both read it, so they cannot disagree. The
 * default is left out of the address, which keeps the canonical URL clean.
 */
const store = createParamStore("tier");

export function useTierFloor(): [TierFloor, (floor: TierFloor) => void] {
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const set = useCallback((floor: TierFloor) => {
    store.write(floor === DEFAULT_TIER_FLOOR ? null : String(floor));
  }, []);
  return [parseTierFloor(raw), set];
}
