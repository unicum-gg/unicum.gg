"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOnClickOutside } from "usehooks-ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ClanSearchChunk } from "@/app/api/[region]/clans/search/route";
import { readNdjson } from "@/lib/ndjson";
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
  const ref = useRef<HTMLDivElement>(null);

  useOnClickOutside(ref as React.RefObject<HTMLElement>, () => setOpen(false));

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
          `/api/${region}/clans/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        let acc: ClanSearchResult[] = [];
        await readNdjson<ClanSearchChunk>(res, (chunk) => {
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

  function pick(tag: string) {
    onPick(tag);
    setOpen(false);
    setQuery("");
  }

  const filtered = excludeKeys
    ? results.filter((r) => !excludeKeys.has(r.tag.toLowerCase()))
    : results;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={triggerAriaLabel}
      className={triggerClassName}
    >
      {triggerContent}
    </button>
  );

  return (
    <div ref={ref} className="relative inline-block">
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : trigger}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-fd-border bg-fd-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-fd-border px-3 py-2">
            <MagnifyingGlassIcon
              className="size-4 shrink-0 text-fd-muted-foreground"
              weight="bold"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clan..."
              spellCheck={false}
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- triggered by user click, focus expected
              autoFocus
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
        </div>
      )}
    </div>
  );
}
