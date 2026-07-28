"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toRoman } from "roman-numerals";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NationFlag } from "@/components/tanks/nation-flag";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import { mergeSearchChunks } from "@/lib/search-merge";
import { unicum } from "@/services/sdk";
import { SearchSource } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

/**
 * A popover that searches the tank catalogue (streamed via the SDK, same as the
 * global search) and calls `onPick` with the chosen tank. Mirrors the player /
 * clan compare search popovers so behaviour (debounce, streamed local+remote
 * merge, stale-query guarding) stays consistent across the site.
 */
export function TankSearchPopover({
  region,
  excludeSlugs,
  onPick,
  triggerClassName,
  triggerContent,
  triggerAriaLabel,
  tooltip,
  placeholder = "Search tank...",
}: {
  region: Region;
  excludeSlugs?: Set<string>;
  onPick: (tank: TankSearchResult) => void;
  triggerClassName: string;
  triggerContent: ReactNode;
  triggerAriaLabel: string;
  tooltip?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results are tagged with the query they belong to, so a stale set from a
  // previous query is hidden by derivation (below) instead of a state reset.
  const [results, setResults] = useState<{
    query: string;
    items: TankSearchResult[];
  }>({ query: "", items: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const active = open && trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let local: TankSearchResult[] = [];
        let remote: TankSearchResult[] = [];
        for await (const chunk of unicum
          .region(region)
          .tanks.searchStream(trimmed, { signal: controller.signal })) {
          const items = chunk.results as TankSearchResult[];
          if (chunk.source === SearchSource.Local) local = items;
          else remote = items;
          setResults({
            query: trimmed,
            items: mergeSearchChunks(local, remote, (t) => t.slug, trimmed),
          });
        }
      } catch {
        // aborted or network failure, ignore
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, trimmed, region]);

  function pick(tank: TankSearchResult) {
    onPick(tank);
    setOpen(false);
    setQuery("");
  }

  const shown = active && results.query === trimmed ? results.items : [];
  const filtered = excludeSlugs
    ? shown.filter((t) => !excludeSlugs.has(t.slug))
    : shown;

  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <PopoverContent
        align="end"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="max-w-[calc(100vw-1rem)] overflow-hidden p-0"
      >
        <div className="flex items-center gap-2 border-b border-fd-border px-3 py-2">
          <MagnifyingGlassIcon
            className="size-4 shrink-0 text-fd-muted-foreground"
            weight="bold"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fd-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {trimmed.length < MIN_QUERY_LENGTH ? (
            <div className="px-3 py-3 text-xs text-fd-muted-foreground">
              Type at least {MIN_QUERY_LENGTH} characters.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-fd-muted-foreground">
              {loading ? "Searching..." : "No matching tanks."}
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.tank_id}
                type="button"
                onClick={() => pick(t)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-brand">
                  {t.tier ? toRoman(t.tier) : t.tier}
                </span>
                <NationFlag nation={t.nation} region={region} className="h-3" />
                <VehicleTypeIcon
                  type={t.type}
                  premium={t.is_premium}
                  className="scale-75"
                />
                <span className="truncate font-medium">{t.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
