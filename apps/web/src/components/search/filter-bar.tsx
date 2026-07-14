"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type Region, REGIONS } from "@unicum.gg/wargaming";

export enum SearchType {
  All = "all",
  Players = "players",
  Clans = "clans",
  Tanks = "tanks",
}

const SEARCH_TYPES: SearchType[] = [
  SearchType.All,
  SearchType.Players,
  SearchType.Clans,
  SearchType.Tanks,
];

const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  [SearchType.All]: "All",
  [SearchType.Players]: "Players",
  [SearchType.Clans]: "Clans",
  [SearchType.Tanks]: "Tanks",
};

export function FilterBar({
  region,
  onRegionChange,
  searchType,
  onSearchTypeChange,
}: {
  region: Region;
  onRegionChange: (r: Region) => void;
  searchType: SearchType;
  onSearchTypeChange: (t: SearchType) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">Region:</span>
        {REGIONS.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => onRegionChange(r)}
            className={cn(
              "rounded px-2 py-1 font-medium uppercase transition-colors",
              r === region
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">Show:</span>
        <Select
          value={searchType}
          onValueChange={(v) => onSearchTypeChange(v as SearchType)}
        >
          <SelectTrigger size="sm" aria-label="Search type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {SEARCH_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
