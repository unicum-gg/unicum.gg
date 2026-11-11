"use client";

import { useDeferredValue, useState } from "react";
import useSWR from "swr";
import {
  ManeuversBoardKind,
  ManeuversOrder,
  ManeuversSort,
} from "@unicum.gg/shared";
import { SortDirection, type SortState } from "@/components/tanks/sortable-head";
import {
  type ManeuversData,
  useManeuversEdition,
} from "@/components/maneuvers/edition-context";
import {
  MANEUVERS_PAGE_SIZE,
  MANEUVERS_PAGE_SIZES,
} from "@/components/maneuvers/limit";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { unicum } from "@/services/sdk";

/**
 * One page of a Maneuvers board, fetched from the endpoint rather than sliced
 * here: the whole board is too large to ship (see `MANEUVERS_PAGE_SIZE`), and
 * a sort on the 24h gain or a search for a nickname has to run across all of
 * it, which only the endpoint can.
 *
 * The page and its size ride in the URL through `useServerPagination`, like
 * the battle list. The first page in the board's own order is what the edition
 * context already holds, so landing on the page costs no request.
 */
export function useManeuversRows(kind: ManeuversBoardKind) {
  const { region, board, requested, loading: editionLoading } = useManeuversEdition();
  const [sort, setSort] = useState<SortState>(null);
  const [query, setQuery] = useState("");
  const [rangeCol, setRangeCol] = useState<string>(ManeuversSort.FamePoints);
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  // Typing stays instant while the request follows the deferred values.
  const q = useDeferredValue(query.trim());
  const min = useDeferredValue(numberOrNull(minVal));
  const max = useDeferredValue(numberOrNull(maxVal));
  const ranged = min != null || max != null;

  const seedTotal =
    kind === ManeuversBoardKind.Players ? board.totals.players : board.totals.clans;
  const [knownTotal, setKnownTotal] = useState(seedTotal);
  const { page, pageSize, pager } = useServerPagination(
    knownTotal,
    MANEUVERS_PAGE_SIZE,
    { sizes: MANEUVERS_PAGE_SIZES },
  );

  const isDefault =
    !sort && !q && !ranged && page === 1 && pageSize === MANEUVERS_PAGE_SIZE;
  const request = () =>
    unicum.region(region).maneuvers({
      board: kind,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(requested ? { edition: requested } : {}),
      ...(sort
        ? {
            sort: sort.key as ManeuversSort,
            order:
              sort.direction === SortDirection.Asc
                ? ManeuversOrder.Asc
                : ManeuversOrder.Desc,
          }
        : {}),
      ...(q ? { q } : {}),
      ...(ranged
        ? {
            range: rangeCol as ManeuversSort,
            ...(min != null ? { min } : {}),
            ...(max != null ? { max } : {}),
          }
        : {}),
    });

  const { data, isValidating } = useSWR<ManeuversData>(
    isDefault || !board.edition ? null : request().url(),
    () => request().then((r) => r),
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const shown = isDefault || !data ? board : data;
  const total =
    kind === ManeuversBoardKind.Players ? shown.totals.players : shown.totals.clans;
  if (total !== knownTotal) setKnownTotal(total);

  // A new order or search starts over at the first page: the reader's place
  // in the old one names different rows in the new one.
  const toggle = (key: string) => {
    setSort((prev) =>
      prev?.key !== key
        ? { key, direction: SortDirection.Desc }
        : prev.direction === SortDirection.Desc
          ? { key, direction: SortDirection.Asc }
          : null,
    );
    pager.setPage(1);
  };
  // Every filter change starts over at the first page, like a new order.
  const narrowing =
    <V,>(set: (v: V) => void) =>
    (next: V) => {
      set(next);
      pager.setPage(1);
    };

  return {
    data: shown,
    total,
    pager,
    sort,
    toggle,
    query,
    filtering: Boolean(q) || ranged,
    filters: {
      setQuery: narrowing(setQuery),
      rangeCol,
      setRangeCol: narrowing(setRangeCol),
      minVal,
      setMinVal: narrowing(setMinVal),
      maxVal,
      setMaxVal: narrowing(setMaxVal),
      active: Boolean(q) || ranged,
    },
    loading: editionLoading || (!isDefault && isValidating),
  };
}

/** A typed bound as a number, null while the box is empty or mid-edit. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
