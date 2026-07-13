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
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { PlayerSearchChunk } from "@/app/api/[region]/players/search/ndjson/route";
import { readNdjson } from "@/lib/ndjson";
import type { Region } from "@unicum.gg/wargaming/region";

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
  const [results, setResults] = useState<SearchPlayerResult[]>([]);
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
        const res = await fetch(
          `/api/${region}/players/search/ndjson?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        let acc: SearchPlayerResult[] = [];
        await readNdjson<PlayerSearchChunk>(res, (chunk) => {
          acc = [...acc, ...chunk.results];
          setResults(acc);
        });
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

  function pick(nickname: string) {
    onPick(nickname);
    setOpen(false);
    setQuery("");
  }

  const filtered = excludeKeys
    ? results.filter((r) => !excludeKeys.has(r.nickname.toLowerCase()))
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
                  <span className="shrink-0 font-mono text-xs">
                    <span style={{ color: r.clan.color }}>[</span>
                    {r.clan.tag}
                    <span style={{ color: r.clan.color }}>]</span>
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
