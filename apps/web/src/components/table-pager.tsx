"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PageSize = number | "all";
export const PAGE_SIZES = [25, 50, 100, 200] as const;

export type PagerState = {
  pageSize: PageSize;
  setPageSize: (s: PageSize) => void;
  page: number;
  setPage: (p: number) => void;
  total: number;
  totalPages: number;
  firstShown: number;
  lastShown: number;
};

// Client-side pagination over an already-sorted/filtered list. Resets to page 1
// whenever the list identity or page size changes (so a new filter/sort lands on
// the first page).
export function usePagination<T>(
  items: T[],
  initialSize: PageSize = 50,
): { paged: T[]; pager: PagerState } {
  // Page + page size live in the URL (?page=&ps=) alongside the filters, so a
  // paginated view is shareable and survives a reload. Written back merged with
  // any other params via replaceState. Defaults (page 1, initial size) are
  // omitted to keep the URL clean.
  const searchParams = useSearchParams();
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    const raw = searchParams.get("ps");
    if (raw === "all") return "all";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : initialSize;
  });
  const [page, setPage] = useState(() => {
    const n = Number(searchParams.get("page"));
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const [sig, setSig] = useState<{ items: T[]; pageSize: PageSize }>({
    items,
    pageSize,
  });
  if (sig.items !== items || sig.pageSize !== pageSize) {
    setSig({ items, pageSize });
    setPage(1);
  }

  const total = items.length;
  const size = pageSize === "all" ? Math.max(total, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, totalPages);
  const startIdx = (current - 1) * size;
  const paged = pageSize === "all" ? items : items.slice(startIdx, startIdx + size);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrDel = (key: string, val: string) => {
      if (val) params.set(key, val);
      else params.delete(key);
    };
    setOrDel("page", current > 1 ? String(current) : "");
    setOrDel("ps", pageSize !== initialSize ? String(pageSize) : "");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [current, pageSize, initialSize]);

  return {
    paged,
    pager: {
      pageSize,
      setPageSize,
      page: current,
      setPage,
      total,
      totalPages,
      firstShown: total === 0 ? 0 : startIdx + 1,
      lastShown: pageSize === "all" ? total : Math.min(startIdx + size, total),
    },
  };
}

export function TablePager({ pager }: { pager: PagerState }) {
  const { pageSize, setPageSize, page, setPage, total, totalPages, firstShown, lastShown } =
    pager;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setPageSize(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="h-7 w-18.5" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {firstShown}–{lastShown} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="cursor-pointer rounded-md border border-fd-border p-1 transition-colors hover:bg-fd-secondary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CaretLeftIcon weight="bold" className="size-3.5" />
          </button>
          <span className="min-w-16 text-center tabular-nums">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="cursor-pointer rounded-md border border-fd-border p-1 transition-colors hover:bg-fd-secondary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <CaretRightIcon weight="bold" className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
