"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { unicum } from "@/services/sdk";
import type { Region } from "@unicum.gg/wargaming/region";
import type { ClanSearchResult } from "@unicum.gg/core/wargaming/wot/clans/search";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function ClanSearchPopover({
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
  onPick: (tag: string) => void;
  triggerClassName: string;
  triggerContent: ReactNode;
  triggerAriaLabel: string;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClanSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setResults([]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let acc: ClanSearchResult[] = [];
        for await (const chunk of unicum
          .region(region)
          .clans.searchStream(trimmed, { signal: controller.signal })) {
          acc = [...acc, ...(chunk.results as ClanSearchResult[])];
          setResults(acc);
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
  }, [query, open, region]);

  function pick(tag: string) {
    onPick(tag);
    setOpen(false);
    setQuery("");
  }

  const filtered = excludeKeys
    ? results.filter((r) => !excludeKeys.has(r.tag.toLowerCase()))
    : results;

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
            placeholder="Search clan..."
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
                No matching clans.
              </div>
            )
          ) : (
            filtered.map((r) => (
              <button
                key={r.clan_id}
                type="button"
                onClick={() => pick(r.tag)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <span className="font-mono">
                  <span style={{ color: r.color }}>[</span>
                  {r.tag}
                  <span style={{ color: r.color }}>]</span>
                </span>
                <span className="truncate text-xs text-fd-muted-foreground">
                  {r.name}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
