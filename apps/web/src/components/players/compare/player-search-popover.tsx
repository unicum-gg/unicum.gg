"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClanTag } from "@/components/entity/clan-tag";
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
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import { mergeSearchChunks } from "@/lib/search-merge";
import { unicum } from "@/services/sdk";
import { SearchSource } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

export function PlayerSearchPopover({
  region,
  excludeKeys,
  onPick,
  triggerClassName,
  triggerContent,
  triggerAriaLabel,
  tooltip,
}: {
  region: Region;
  excludeKeys?: Set<string>;
  onPick: (nickname: string) => void;
  triggerClassName: string;
  triggerContent: ReactNode;
  triggerAriaLabel: string;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results are tagged with the query they belong to, so a stale set from a
  // previous query is hidden by derivation (below) instead of a state reset in
  // the effect.
  const [results, setResults] = useState<{
    query: string;
    items: SearchPlayerResult[];
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
        // Merge (not append) the local and remote chunks: one capped page,
        // exact nickname hoisted first.
        let local: SearchPlayerResult[] = [];
        let remote: SearchPlayerResult[] = [];
        for await (const chunk of unicum
          .region(region)
          .players.searchStream(trimmed, { signal: controller.signal })) {
          const results = chunk.results as SearchPlayerResult[];
          if (chunk.source === SearchSource.Local) local = results;
          else remote = results;
          setResults({
            query: trimmed,
            items: mergeSearchChunks(local, remote, (r) => r.nickname, trimmed),
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

  function pick(nickname: string) {
    onPick(nickname);
    setOpen(false);
    setQuery("");
  }

  // Only show results for the current, valid, open query.
  const shown = active && results.query === trimmed ? results.items : [];
  const filtered = excludeKeys
    ? shown.filter((r) => !excludeKeys.has(r.nickname.toLowerCase()))
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
        // Focus the search field on open (not the Radix-default first item).
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
            placeholder="Search player..."
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-fd-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <div className="px-3 py-3 text-xs text-fd-muted-foreground">
              Type at least {MIN_QUERY_LENGTH} characters.
            </div>
          ) : filtered.length === 0 ? (
            loading ? (
              <div className="px-3 py-3 text-xs text-fd-muted-foreground">
                Searching...
              </div>
            ) : (
              <div className="px-3 py-3 text-xs text-fd-muted-foreground">
                No matching players.
              </div>
            )
          ) : (
            filtered.map((r) => (
              <button
                key={r.account_id}
                type="button"
                onClick={() => pick(r.nickname)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <span className="truncate font-medium">{r.nickname}</span>
                {r.clan && (
                  <ClanTag
                    tag={r.clan.tag}
                    color={r.clan.color}
                    className="shrink-0 font-mono text-xs"
                  />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
