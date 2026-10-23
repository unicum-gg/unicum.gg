"use client";

import { useSyncExternalStore } from "react";
import {
  parsePage,
  parseSize,
  sizeParamFor,
  type PagerState,
} from "@/components/table-pager";
import { readSearch, sharedParamStore } from "@/lib/url-param-store";
import PAGINATION from "@/constants/pagination";

const nullSnapshot = () => null;
const emptySnapshot = () => "";

/**
 * The pager for a list the server hands over a page at a time.
 *
 * `usePagination` is the rule on this site and slices a list it already holds
 * whole. That stops being honest where one row is heavy and the list has no
 * ceiling: a player's battles carry a minimap and a loadout each and grow with
 * every game, so loading them whole would cost a heavy player thousands of
 * rows to read twenty-five. This keeps everything a reader sees the same (the
 * `TablePager` controls, `?page=`/`?ps=` in the address bar, Back and Forward)
 * and leaves the slicing to the endpoint, which is told `page` and `pageSize`
 * and answers the total.
 *
 * The URL is the only state. A page is a fetch here rather than a slice, so
 * there is no list to reset when it changes, which is the whole of what the
 * local state in `usePagination` exists for.
 */
export function useServerPagination(
  total: number,
  initialSize: number,
  options: {
    /** See `PaginationOptions.param`. */
    param?: string;
    /** The row counts offered; the endpoint's own ceiling bounds them. */
    sizes: readonly number[];
  },
): { page: number; pageSize: number; pager: PagerState } {
  const { param = PAGINATION.PARAM, sizes } = options;
  const pageStore = sharedParamStore(param);
  const sizeStore = sharedParamStore(sizeParamFor(param));
  const urlPage = useSyncExternalStore(pageStore.subscribe, pageStore.read, nullSnapshot);
  const urlSize = useSyncExternalStore(sizeStore.subscribe, sizeStore.read, nullSnapshot);
  const search = useSyncExternalStore(pageStore.subscribe, readSearch, emptySnapshot);

  // A size the endpoint does not serve (an "all" from another table's link, a
  // hand-typed thousand) falls back to the default rather than being trusted.
  const parsed = parseSize(urlSize, initialSize);
  const pageSize =
    typeof parsed === "number" && sizes.includes(parsed) ? parsed : initialSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(parsePage(urlPage) ?? 1, totalPages);
  const start = (page - 1) * pageSize;

  const setPage = (next: number) =>
    pageStore.write(next > 1 ? String(next) : null);

  return {
    page,
    pageSize,
    pager: {
      pageSize,
      // A new row count starts over at the first page: the reader's place in
      // the old one names different rows in the new one.
      setPageSize: (next) => {
        sizeStore.write(next !== initialSize ? String(next) : null);
        pageStore.write(null);
      },
      page,
      setPage,
      total,
      totalPages,
      firstShown: total === 0 ? 0 : start + 1,
      lastShown: Math.min(start + pageSize, total),
      hrefFor: (n) => {
        const params = new URLSearchParams(search);
        params.set(param, String(n));
        return `?${params.toString()}`;
      },
      crawlable: false,
      sizes,
      allowAll: false,
    },
  };
}
