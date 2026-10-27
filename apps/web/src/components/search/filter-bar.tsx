"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/segmented-control";
import { type Region, REGIONS } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";

export enum SearchType {
  All = "all",
  Players = "players",
  Clans = "clans",
  Tanks = "tanks",
  Maps = "maps",
  Glossary = "glossary",
}

const SEARCH_TYPES: SearchType[] = [
  SearchType.All,
  SearchType.Players,
  SearchType.Clans,
  SearchType.Tanks,
  SearchType.Maps,
  SearchType.Glossary,
];

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
  const { t } = useTranslation("components/search");
  const { t: tOwn } = useTranslation("components/search/filter-bar");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">{tOwn("region")}</span>
        <SegmentedControl
          compact
          active={region}
          onSelect={onRegionChange}
          segments={REGIONS.map((r) => ({ id: r, label: r.toUpperCase() }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-fd-muted-foreground">{tOwn("show")}</span>
        <Select
          value={searchType}
          onValueChange={(v) => onSearchTypeChange(v as SearchType)}
        >
          <SelectTrigger size="sm" aria-label={t("type")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`types.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
