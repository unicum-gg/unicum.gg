"use client";

import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaderboardFilters } from "@/hooks/use-leaderboard-filter";

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
  searchNoun: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      <input
        type="text"
        value={filters.query}
        onChange={(e) => filters.setQuery(e.target.value)}
        placeholder={`Search ${filters.totalCount.toLocaleString("en-US")} ${searchNoun}`}
        className="h-7 w-56 rounded-md border border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-ring focus:outline-none"
      />
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
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="number"
          value={filters.minVal}
          onChange={(e) => filters.setMinVal(e.target.value)}
          placeholder="Min"
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
        <input
          type="number"
          value={filters.maxVal}
          onChange={(e) => filters.setMaxVal(e.target.value)}
          placeholder="Max"
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
      </div>
      {extra}
      {filters.active && (
        <span className="text-xs text-fd-muted-foreground tabular-nums">
          {filters.resultCount.toLocaleString("en-US")} of{" "}
          {filters.totalCount.toLocaleString("en-US")}
        </span>
      )}
    </div>
  );
}
