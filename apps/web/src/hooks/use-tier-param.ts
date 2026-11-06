"use client";

import { useCallback, useSyncExternalStore } from "react";
import { sharedParamStore } from "@/lib/url-param-store";

/** The query param a panel's tier switch is held in. */
export const TIER_PARAM = "tier";

const store = sharedParamStore(TIER_PARAM);

/**
 * Which tier a panel's switch shows, in `?tier=`.
 *
 * In the URL so a reading of one tier is a link ("what Onslaught pays at tier
 * VIII" has to be sendable) and so a reader or an agent landing on it sees the
 * tier it was sent to. The pages carrying these panels are static, so the
 * server always renders `fallback` and a linked tier is applied on hydration,
 * which is why the panels render every tier and hide the others rather than
 * only the chosen one: the HTML holds every figure whatever the URL says.
 *
 * The fallback carries no param, the way the first page of a table carries no
 * `?page=`, and a tier the panel has no row for reads as the fallback rather
 * than as an empty table.
 */
export function useTierParam(
  tiers: number[],
  fallback: number,
): [number, (next: number) => void] {
  const tier = useSyncExternalStore(
    store.subscribe,
    () => {
      const asked = Number(store.read());
      return tiers.includes(asked) ? asked : fallback;
    },
    () => fallback,
  );
  const setTier = useCallback(
    (next: number) => store.write(next === fallback ? null : String(next)),
    [fallback],
  );
  return [tier, setTier];
}
