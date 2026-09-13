"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { pageWindow, PAGE_GAP } from "@/components/table-pager-window";
import { readSearch, sharedParamStore } from "@/lib/url-param-store";
import PAGINATION from "@/constants/pagination";

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
  /** The URL of one page of this table, for the controls below. */
  hrefFor: (page: number) => string;
  /** Whether those controls are links a crawler may follow. See the options. */
  crawlable: boolean;
};

export type PaginationOptions = {
  /**
   * The query param the page rides in. Several VIEWS of one table share the
   * default (the leaderboards mount the same board once per rating metric and
   * all three mean the same page), while two DIFFERENT tables on one page each
   * name their own, or moving one would move the other.
   */
  param?: string;
  /**
   * The page the server rendered, from the route's own `/page/[n]` segment.
   *
   * The URL is only readable client-side, so without this the prerendered HTML
   * of `?page=4` is page 1 and the rows only arrive at hydration, which is
   * exactly what a crawler does not wait for.
   */
  initialPage?: number;
  /**
   * Render the controls as links rather than buttons.
   *
   * On for a board that IS the page's subject, since a crawler does not click a
   * button and would never see past page 1. Off for a table that is one panel
   * among many on an entity page: those pages number in the millions, and 18
   * followable pages of tank rows on each is a crawl budget spent on a panel.
   */
  crawlable?: boolean;
};

/** The `?ps=` twin of a page param, so two tables do not share one row count. */
function sizeParamFor(param: string): string {
  return param === PAGINATION.PARAM ? "ps" : `${param}-ps`;
}

function parsePage(raw: string | null): number | null {
  const value = Number(raw);
  return raw !== null && Number.isInteger(value) && value > 0 ? value : null;
}

function parseSize(raw: string | null, fallback: PageSize): PageSize {
  if (raw === "all") return "all";
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Client-side pagination over an already-sorted/filtered list. Resets to page 1
 * whenever the list identity or page size changes (so a new filter/sort lands on
 * the first page).
 *
 * Page and size live in the URL (`?page=`/`?ps=`), read through the shared param
 * store rather than held privately: a table mounted several times over (one view
 * per rating metric) then agrees with itself instead of each copy clobbering the
 * others' param, which is why those boards used to opt out of the URL entirely.
 * `initialPage` is what the server rendered, and the URL takes over at hydration.
 */
export function usePagination<T>(
  items: T[],
  initialSize: PageSize = 50,
  options: PaginationOptions = {},
): { paged: T[]; pager: PagerState } {
  const {
    param = PAGINATION.PARAM,
    initialPage,
    crawlable = false,
  } = options;
  const pageStore = sharedParamStore(param);
  const sizeStore = sharedParamStore(sizeParamFor(param));

  // The server has no URL to read, so both snapshots answer null there and the
  // route's own `initialPage` stands in. React re-reads them once hydrated,
  // which is where the address bar takes over.
  const urlPage = useSyncExternalStore(pageStore.subscribe, pageStore.read, nullSnapshot);
  const urlSize = useSyncExternalStore(sizeStore.subscribe, sizeStore.read, nullSnapshot);
  const search = useSyncExternalStore(pageStore.subscribe, readSearch, emptySnapshot);

  const [pageSize, setPageSize] = useState<PageSize>(initialSize);
  const [page, setPage] = useState(initialPage ?? 1);

  // Adopt a value the URL moved to without us: another view of this table, Back
  // or Forward, or the address bar arriving at hydration. Tracked against what
  // was last seen rather than against the state, so a reader who paged back to
  // where the URL already was is not dragged forward again.
  const [seen, setSeen] = useState<{ page: string | null; size: string | null }>({
    page: null,
    size: null,
  });
  if (seen.page !== urlPage || seen.size !== urlSize) {
    setSeen({ page: urlPage, size: urlSize });
    if (seen.size !== urlSize) setPageSize(parseSize(urlSize, initialSize));
    if (seen.page !== urlPage) setPage(parsePage(urlPage) ?? 1);
  }

  const total = items.length;
  const size = pageSize === "all" ? Math.max(total, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / size));

  // A new list starts at page 1, which is what a reader expects of a filter or a
  // sort. Judged on the ROWS and not on the array's identity, because the two
  // part company on every page: a memo re-runs whenever one of its dependencies
  // moves, and several of ours move just after hydration without changing an
  // ordering (the rating metric is read from a cookie in an effect, and the
  // catalogue's sort memo depends on it whether or not the column it is sorted
  // by does). On identity alone, every reader who had ever picked a rating
  // metric lost their `?page=` a tick after the page they asked for appeared.
  const [sig, setSig] = useState<{ items: T[]; pageSize: PageSize; rows: T[] }>(
    () => ({
      items,
      pageSize,
      rows: slicePage(items, initialPage ?? 1, size, pageSize),
    }),
  );
  if (sig.items !== items || sig.pageSize !== pageSize) {
    const held = slicePage(items, Math.min(page, totalPages), size, pageSize);
    const settled = sameRows(held, sig.rows);
    setSig({
      items,
      pageSize,
      rows: settled ? held : slicePage(items, 1, size, pageSize),
    });
    if (!settled) setPage(1);
  }

  const current = Math.min(page, totalPages);
  const startIdx = (current - 1) * size;
  const paged = slicePage(items, current, size, pageSize);

  // Mirror back, merged with whatever else the URL carries. Defaults (page 1,
  // the table's own initial size) are written as an absent param rather than a
  // spelled-out one, so the canonical address of a board stays the bare path.
  useEffect(() => {
    const wanted = current > 1 ? String(current) : null;
    if (pageStore.read() !== wanted) pageStore.write(wanted);
  }, [pageStore, current]);
  useEffect(() => {
    const wanted = pageSize !== initialSize ? String(pageSize) : null;
    if (sizeStore.read() !== wanted) sizeStore.write(wanted);
  }, [sizeStore, pageSize, initialSize]);

  // Always spelled out, page 1 included: `?page=1` is redirected onto the bare
  // path, which is one hop for a crawler and a canonical URL that cannot be
  // reached two ways. Built from the query the reader arrived with on the
  // client and from the page alone on the server, so what ships in the HTML is
  // the page and never someone's filters.
  const hrefFor = (n: number): string => {
    const params = new URLSearchParams(search);
    params.set(param, String(n));
    return `?${params.toString()}`;
  };

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
      hrefFor,
      crawlable,
    },
  };
}

const nullSnapshot = () => null;
const emptySnapshot = () => "";

/** One page of a list, or the whole of it when the reader asked for every row. */
function slicePage<T>(
  items: T[],
  page: number,
  size: number,
  pageSize: PageSize,
): T[] {
  if (pageSize === "all") return items;
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

/** Whether two pages hold the same rows, in the same order. */
function sameRows<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((row, i) => row === b[i]);
}

/** Whether a click is the plain one we answer ourselves, rather than the
 * reader asking their browser for a second tab or a download. */
function isPlainClick(event: React.MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

const CONTROL_CLASS =
  "cursor-pointer rounded-md border border-fd-border p-1 transition-colors hover:bg-fd-secondary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * One page control, a link where the table is the page's own subject and a
 * button where it is not.
 *
 * The link is what a crawler follows, and it is a real navigation for anyone
 * who opens it in a second tab; a plain click is answered in place, since the
 * whole list is already loaded and a round-trip would only redraw it.
 */
function PagerControl({
  pager,
  page,
  disabled,
  label,
  current,
  className,
  children,
}: {
  pager: PagerState;
  page: number;
  disabled?: boolean;
  label: string;
  current?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = `${CONTROL_CLASS} ${className ?? ""}`;
  if (!pager.crawlable || disabled) {
    return (
      <button
        type="button"
        onClick={() => pager.setPage(page)}
        disabled={disabled}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        className={classes}
      >
        {children}
      </button>
    );
  }
  return (
    <a
      href={pager.hrefFor(page)}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        pager.setPage(page);
      }}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={classes}
    >
      {children}
    </a>
  );
}

export function TablePager({
  pager,
  children,
}: {
  pager: PagerState;
  /**
   * Controls that belong to the table rather than to its pagination, shown
   * beside the row count. The economics catalogue puts its Free XP conversion
   * there, which is the reason this component is not the whole footer.
   */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation("components/table-pager");
  const { pageSize, setPageSize, page, total, totalPages, firstShown, lastShown } =
    pager;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-4 py-3 text-xs text-fd-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span>{t("rows-per-page")}</span>
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
            <SelectItem value="all">{t("all")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
        {children}
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {t("range", { first: firstShown, last: lastShown, total })}
        </span>
        {/* A table holding one page has no pagination to draw, and a link to the
            page the reader is already on is a redirect a crawler follows for
            nothing. The rows-per-page select above stays either way: it is what
            creates a second page in the first place. */}
        {totalPages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center gap-1">
          <PagerControl
            pager={pager}
            page={page - 1}
            disabled={page <= 1}
            label={t("previous")}
          >
            <CaretLeftIcon weight="bold" className="size-3.5" />
          </PagerControl>
          {/* The numbers matter beyond the click: prev/next alone puts page ten
              ten hops from the first, which is deeper than a crawler follows a
              list it has no other way into. */}
          {pageWindow(page, totalPages).map((entry, i) =>
            entry === PAGE_GAP ? (
              <span key={`gap-${i}`} className="px-1 select-none">
                &hellip;
              </span>
            ) : (
              <PagerControl
                key={entry}
                pager={pager}
                page={entry}
                current={entry === page}
                label={t("page", { page: entry, total: totalPages })}
                className={`min-w-6 px-1 text-center tabular-nums ${
                  entry === page
                    ? "border-fd-foreground/30 bg-fd-secondary/60 text-fd-foreground"
                    : ""
                }`}
              >
                {entry}
              </PagerControl>
            ),
          )}
          <PagerControl
            pager={pager}
            page={page + 1}
            disabled={page >= totalPages}
            label={t("next")}
          >
            <CaretRightIcon weight="bold" className="size-3.5" />
          </PagerControl>
        </nav>
        )}
      </div>
    </div>
  );
}
