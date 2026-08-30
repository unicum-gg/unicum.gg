"use client";

import Link from "next/link";
import { GlossaryLabel } from "@/components/glossary/label";
import { MinimapImage } from "@/components/maps/minimap-image";
import { formatMapChange } from "@/components/maps/change-format";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

export type MapChangeRow = {
  field: string;
  previous: string | null;
  next: string | null;
};

export type FeedMap = {
  arenaId: string;
  slug: string;
  name: string;
  minimapUrl: string;
  nightCommonTest: boolean;
  changes: MapChangeRow[];
};

/**
 * One map and what a single update (or the running test build) changed about it:
 * the map on the left, the changes on the right.
 *
 * Nothing is coloured, unlike the tank feed: a map change has no buff or nerf
 * side. Each line states what happened in words instead, since a spawn's new
 * coordinates only mean something drawn on the map itself, which is what the
 * map's own history panel is for.
 */
export function MapBlock({
  region,
  map,
  pending = false,
}: {
  region: Region;
  map: FeedMap;
  /** Whether the block sits in the Common Test panel, where a presence row must
   * not claim the map reached the game. */
  pending?: boolean;
}) {
  const changes = map.changes.map((c) =>
    formatMapChange(c.field, c.previous, c.next, pending),
  );
  if (changes.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row">
      <Link
        href={ROUTES.MAP(region, map.slug)}
        className="group flex shrink-0 items-start gap-3 px-4 py-3 sm:w-52"
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded border border-fd-border">
          <MinimapImage
            src={map.minimapUrl}
            arenaId={map.arenaId}
            alt=""
            sizes="48px"
          />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium group-hover:text-brand">
            {map.name}
          </div>
          <div className="mt-0.5 text-xs text-fd-muted-foreground tabular-nums">
            {changes.length} change{changes.length === 1 ? "" : "s"}
          </div>
        </div>
      </Link>
      <ul className="flex-1 divide-y divide-fd-border sm:border-l sm:border-fd-border">
        {changes.map((change) => (
          <li
            key={change.field}
            className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm"
          >
            <span className="text-fd-muted-foreground">
              <GlossaryLabel>{change.label}</GlossaryLabel>
            </span>
            <span className="text-right font-medium tabular-nums">
              {change.before && change.after ? (
                <>
                  <span className="text-fd-muted-foreground">{change.before}</span>
                  <span className="mx-1.5 text-fd-muted-foreground">→</span>
                  {change.after}
                </>
              ) : (
                change.summary
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
