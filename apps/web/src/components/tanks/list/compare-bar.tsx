"use client";

import Link from "next/link";
import { ScalesIcon, XIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import type { TankSelection } from "@/hooks/use-compare-selection";
import { cn } from "@/lib/utils";

/**
 * What you picked, and the way out of the list.
 *
 * Floating over the table rather than sat above it: the picking happens while
 * scrolling a thousand vehicles, so the count and the button have to be where
 * the eyes already are. It only exists once something is picked.
 */
export function TankCompareBar({
  region,
  selection,
  names,
}: {
  region: Region;
  selection: TankSelection;
  /** Display name per selected slug, for the chips. */
  names: Map<string, string>;
}) {
  if (selection.slugs.length === 0) return null;
  const ready = selection.slugs.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full border border-fd-border bg-fd-background/95 px-3 py-2 shadow-lg backdrop-blur">
        {selection.slugs.map((slug) => (
          <span
            key={slug}
            className="flex items-center gap-1 rounded-full bg-fd-secondary/50 py-0.5 pr-1 pl-2.5 text-xs"
          >
            <span className="max-w-32 truncate">{names.get(slug) ?? slug}</span>
            <button
              type="button"
              onClick={() => selection.toggle(slug)}
              aria-label={`Remove ${names.get(slug) ?? slug}`}
              className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full text-fd-muted-foreground hover:bg-fd-border/50 hover:text-fd-foreground"
            >
              <XIcon className="size-2.5" weight="bold" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={selection.clear}
          className="cursor-pointer px-1 text-xs text-fd-muted-foreground hover:text-fd-foreground hover:underline"
        >
          Clear
        </button>
        {ready ? (
          <Link
            href={ROUTES.COMPARE_TANKS(region, selection.slugs)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand/90"
          >
            <ScalesIcon className="size-3.5" weight="bold" />
            Compare {selection.slugs.length}
          </Link>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-fd-secondary/50 px-3 py-1 text-xs text-fd-muted-foreground",
            )}
          >
            <ScalesIcon className="size-3.5" weight="bold" />
            Pick one more
          </span>
        )}
      </div>
    </div>
  );
}
