"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RangeColumn } from "@/hooks/use-tank-filters";

export type { RangeColumn };

export type LeaderboardFilters<T> = {
  query: string;
  setQuery: (v: string) => void;
  rangeCol: string;
  setRangeCol: (k: string) => void;
  minVal: string;
  setMinVal: (v: string) => void;
  maxVal: string;
  setMaxVal: (v: string) => void;
  rangeCols: RangeColumn<T>[];
  activeRangeCol: RangeColumn<T> | undefined;
  resultCount: number;
  totalCount: number;
  active: boolean;
};

/**
 * Client-side leaderboard filter: a free-text search plus a min/max range on a
 * selectable numeric column, over an already-loaded list. Sorting/pagination
 * stay with the caller; this only narrows the set. `filtered` is memoized so its
 * reference is stable while the inputs are unchanged (the pager resets to page 1
 * on a new list reference, so a churning reference would fight pagination).
 *
 * Pass a memoized `rangeCols` and a stable `searchFields` (the memo keys on
 * them), so the filtered reference only changes when a filter actually does.
 */
export function useLeaderboardFilter<T>(
  items: T[],
  opts: {
    searchFields: (item: T) => (string | null | undefined)[];
    rangeCols: RangeColumn<T>[];
    initialRangeCol: string;
    // Mirror the filter to `?q=&rc=&min=&max=` (shareable, survives reload). Off
    // by default; leave off where several boards mount at once and would fight
    // over the shared params (the Overall wn7/wn8/wnx boards).
    syncUrl?: boolean;
  },
): { filtered: T[]; filters: LeaderboardFilters<T> } {
  const { searchFields, rangeCols, initialRangeCol, syncUrl = false } = opts;
  const [query, setQuery] = useState("");
  const [rangeCol, setRangeCol] = useState(initialRangeCol);
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");

  // Seed from the URL once on mount (client-only, so a static page stays static
  // and there is no SSR mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!syncUrl) return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get("q");
    if (q) setQuery(q);
    const rc = p.get("rc");
    if (rc && rangeCols.some((c) => c.key === rc)) setRangeCol(rc);
    const mn = p.get("min");
    if (mn) setMinVal(mn);
    const mx = p.get("max");
    if (mx) setMaxVal(mx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Skip the first commit so the mount seed above (which runs after) is not
  // clobbered by an empty-state write.
  const skipWrite = useRef(true);
  useEffect(() => {
    if (!syncUrl) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    const p = new URLSearchParams(window.location.search);
    const setOrDel = (k: string, v: string) => {
      if (v) p.set(k, v);
      else p.delete(k);
    };
    setOrDel("q", query.trim());
    const hasRange = minVal.trim() !== "" || maxVal.trim() !== "";
    setOrDel("rc", hasRange ? rangeCol : "");
    setOrDel("min", minVal.trim());
    setOrDel("max", maxVal.trim());
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [syncUrl, query, rangeCol, minVal, maxVal]);

  const activeRangeCol = rangeCols.find((c) => c.key === rangeCol);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minN = minVal.trim() === "" ? null : Number(minVal);
    const maxN = maxVal.trim() === "" ? null : Number(maxVal);
    const hasMin = minN != null && Number.isFinite(minN);
    const hasMax = maxN != null && Number.isFinite(maxN);
    if (!q && !hasMin && !hasMax) return items;
    return items.filter((it) => {
      if (
        q &&
        !searchFields(it).some((v) => v?.toLowerCase().includes(q))
      )
        return false;
      if ((hasMin || hasMax) && activeRangeCol) {
        const val = activeRangeCol.value(it);
        if (val == null) return false;
        if (hasMin && val < minN!) return false;
        if (hasMax && val > maxN!) return false;
      }
      return true;
    });
  }, [items, query, minVal, maxVal, activeRangeCol, searchFields]);

  return {
    filtered,
    filters: {
      query,
      setQuery,
      rangeCol,
      setRangeCol,
      minVal,
      setMinVal,
      maxVal,
      setMaxVal,
      rangeCols,
      activeRangeCol,
      resultCount: filtered.length,
      totalCount: items.length,
      active: query.trim() !== "" || minVal.trim() !== "" || maxVal.trim() !== "",
    },
  };
}
