"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import { statLabel } from "@/components/stat-label";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaderboardFilters } from "@/hooks/use-leaderboard-filter";
import { FilterSubject } from "@/components/filter-subject";
import { useTranslation } from "@/hooks/use-translation";

// The players-leaderboard filter section: a free-text search plus a min/max
// range on a chosen column. Mirrors the tank filter bar's search + range
// controls so the two read as siblings. `searchNoun` labels the placeholder;
// `extra` hosts page-specific controls (e.g. rank chips).
export function LeaderboardFilterBar<T>({
  filters,
  searchNoun,
  extra,
}: {
  filters: LeaderboardFilters<T>;
  /** What the board holds, as a key into `components/filter-bar`. See
   * `FilterSubject`: the placeholder is a whole sentence per subject. */
  searchNoun: FilterSubject;
  extra?: ReactNode;
}) {
  const { locale } = useLocale();
  const { t: tStats } = useTranslation("components/stat-labels");
  const { t } = useTranslation("components/filter-bar");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      <input
        type="text"
        value={filters.query}
        onChange={(e) => filters.setQuery(e.target.value)}
        placeholder={t(`search.${searchNoun}`, {
          count: numberFormat(locale).format(filters.totalCount),
        })}
        className="h-7 w-56 rounded-md border border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-ring focus:outline-none"
      />
      {/* Only when there is something to range over: a board that passes no
          range column would otherwise render an empty select between two inputs
          that filter nothing. */}
      {filters.rangeCols.length > 0 && (
      <div className="flex h-7 items-center overflow-hidden rounded-md border border-fd-border">
        <Select value={filters.rangeCol} onValueChange={filters.setRangeCol}>
          <SelectTrigger
            size="sm"
            className="h-full! w-32 rounded-none border-0 bg-transparent px-3 text-xs font-medium text-fd-foreground shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-fd-secondary/40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.rangeCols.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {statLabel(c.label, tStats)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="number"
          value={filters.minVal}
          onChange={(e) => filters.setMinVal(e.target.value)}
          placeholder={t("min")}
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
        <input
          type="number"
          value={filters.maxVal}
          onChange={(e) => filters.setMaxVal(e.target.value)}
          placeholder={t("max")}
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
      </div>
      )}
      {extra}
      {filters.active && (
        <span className="text-xs text-fd-muted-foreground tabular-nums">
          {numberFormat(locale).format(filters.resultCount)} of{" "}
          {numberFormat(locale).format(filters.totalCount)}
        </span>
      )}
    </div>
  );
}
