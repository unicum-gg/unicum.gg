"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACTIVITY_BUCKETS,
  type ActivityBucket,
  BoardView,
  DropoutSortCol,
  type DropoutSortState,
  isBoardView,
  isDropoutSortCol,
  isOnslaughtSortCol,
  OnslaughtSortCol,
  type OnslaughtSortState,
  SortDirection,
} from "@/components/players/list/onslaught/row";
import { OnslaughtRank } from "@unicum.gg/shared";

/**
 * The board's sort and its two chip filters, mirrored to the URL.
 *
 * Held here rather than in the board so a shared link carries what the reader
 * was looking at: the query string is seeded from once on mount and written
 * back on every change, `replaceState` so it never adds a history entry to back
 * out of. The default sort writes nothing, which keeps the bare URL clean.
 */
export function useOnslaughtBoardControls() {
  // Rating Points descending is the game's own order (its ranks derive from it).
  const [sort, setSort] = useState<OnslaughtSortState>({
    col: OnslaughtSortCol.Rating,
    dir: SortDirection.Desc,
  });
  const [tiers, setTiers] = useState<Set<OnslaughtRank>>(() => new Set());
  const [activity, setActivity] = useState<Set<ActivityBucket>>(
    () => new Set(),
  );
  const [view, setView] = useState<BoardView>(BoardView.Ranked);
  // The lost view sorts by when the place was lost, since the question it
  // answers is who just lost one.
  const [lostSort, setLostSort] = useState<DropoutSortState>({
    col: DropoutSortCol.LeftAt,
    dir: SortDirection.Desc,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const col = p.get("sort");
    if (col && isOnslaughtSortCol(col)) {
      setSort({
        col,
        dir: p.get("dir") === "asc" ? SortDirection.Asc : SortDirection.Desc,
      });
    }
    const ranks = (p.get("rank") ?? "")
      .split(",")
      .filter(
        (r): r is OnslaughtRank =>
          r === OnslaughtRank.Legend || r === OnslaughtRank.Champion,
      );
    if (ranks.length) setTiers(new Set(ranks));
    const buckets = (p.get("activity") ?? "")
      .split(",")
      .filter((a): a is ActivityBucket =>
        (ACTIVITY_BUCKETS as readonly string[]).includes(a),
      );
    if (buckets.length) setActivity(new Set(buckets));
    const requested = p.get("view");
    if (requested && isBoardView(requested)) setView(requested);
    const lostCol = p.get("lostSort");
    if (lostCol && isDropoutSortCol(lostCol)) {
      setLostSort({
        col: lostCol,
        dir:
          p.get("lostDir") === "asc" ? SortDirection.Asc : SortDirection.Desc,
      });
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Skipped once, so mounting with a URL to read does not immediately rewrite
  // it from the defaults it has not applied yet.
  const seeded = useRef(true);
  useEffect(() => {
    if (seeded.current) {
      seeded.current = false;
      return;
    }
    const p = new URLSearchParams(window.location.search);
    const setOrDel = (key: string, value: string) => {
      if (value) p.set(key, value);
      else p.delete(key);
    };
    const isDefaultSort =
      sort.col === OnslaughtSortCol.Rating && sort.dir === SortDirection.Desc;
    setOrDel("sort", isDefaultSort ? "" : sort.col);
    setOrDel("dir", isDefaultSort ? "" : sort.dir);
    setOrDel("rank", [...tiers].join(","));
    setOrDel("activity", [...activity].join(","));
    setOrDel("view", view === BoardView.Ranked ? "" : view);
    const isDefaultLostSort =
      lostSort.col === DropoutSortCol.LeftAt &&
      lostSort.dir === SortDirection.Desc;
    setOrDel("lostSort", isDefaultLostSort ? "" : lostSort.col);
    setOrDel("lostDir", isDefaultLostSort ? "" : lostSort.dir);
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [sort, tiers, activity, view, lostSort]);

  return {
    view,
    setView,
    sort,
    setSort,
    lostSort,
    setLostSort,
    tiers,
    toggleTier: (tier: OnslaughtRank) =>
      setTiers((prev) => toggled(prev, tier)),
    activity,
    toggleActivity: (bucket: ActivityBucket) =>
      setActivity((prev) => toggled(prev, bucket)),
  };
}

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
