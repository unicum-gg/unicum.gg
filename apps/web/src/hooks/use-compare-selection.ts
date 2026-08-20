"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MAX_COMPARE_TANKS } from "@/constants/compare";

/** The query param the selection rides in. Each tab of the catalogue is a route
 * of its own and the tab bar carries the query string across (it is what keeps
 * the filters), so living here is what makes a pick survive a tab change. */
export const COMPARE_PARAM = "compare";

/** The vehicles picked out of a list, on their way to a comparison. */
export interface TankSelection {
  slugs: string[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
  clear: () => void;
  /** False once the comparison is full, so a row can grey its checkbox out
   * rather than silently doing nothing. */
  canAdd: boolean;
  max: number;
}

function parse(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const slug = part.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length === MAX_COMPARE_TANKS) break;
  }
  return out;
}

/**
 * Picking vehicles to compare while reading a list.
 *
 * Held in the URL rather than in component state: the catalogue's tabs are five
 * separate routes, so a component-state selection was silently emptied the
 * moment the reader switched from the damage per minute to the mark thresholds.
 * The tab bar already carries the query string across for the filters, so the
 * picks travel with them.
 *
 * Written with `replaceState`, like the tank configurator's setup: no navigation
 * and no server render for something that is only a scratch selection on the way
 * to a comparison, which is the thing worth being a real link.
 *
 * Order is preserved: the first vehicle picked owns the comparison's path, the
 * way it does everywhere else.
 */
export function useTankSelection(): TankSelection {
  const searchParams = useSearchParams();
  // Seeded from the URL, then owned here: the writes below are replaceState, so
  // Next never re-renders this tree and the param alone would go stale.
  const [slugs, setSlugs] = useState<string[]>(() =>
    parse(searchParams.get(COMPARE_PARAM)),
  );

  // Updates are functional: two checkboxes ticked in the same tick both have to
  // land, and reading `slugs` from the closure would make the second overwrite
  // the first with a one-item list.
  const toggle = useCallback((slug: string) => {
    setSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COMPARE_TANKS) return prev;
      return [...prev, slug];
    });
  }, []);

  const clear = useCallback(() => setSlugs([]), []);

  // Mirror into the URL (replaceState, so no navigation and no server render),
  // which is what carries the picks across a tab change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.delete(COMPARE_PARAM);
    if (slugs.length) params.set(COMPARE_PARAM, slugs.join(","));
    const qs = params.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (url !== current) window.history.replaceState(null, "", url);
  }, [slugs]);
  const set = useMemo(() => new Set(slugs), [slugs]);

  return {
    slugs,
    has: (slug: string) => set.has(slug),
    toggle,
    clear,
    canAdd: slugs.length < MAX_COMPARE_TANKS,
    max: MAX_COMPARE_TANKS,
  };
}
