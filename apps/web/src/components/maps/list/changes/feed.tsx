"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MinimapImage } from "@/components/maps/minimap-image";
import { formatMapChange } from "@/components/maps/change-format";
import { Panel, PanelContent } from "@/components/panel";
import { TablePager, usePagination } from "@/components/table-pager";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

type MapChangeRow = { field: string; previous: string | null; next: string | null };
type FeedMap = {
  arenaId: string;
  slug: string;
  name: string;
  minimapUrl: string;
  changes: MapChangeRow[];
};
export type MapFeedVersion = {
  gameVersion: string;
  capturedAt: string | Date;
  maps: FeedMap[];
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * The global map-changes feed: every map an update touched, grouped by game
 * version (newest first) then by map (most-changed first).
 *
 * Nothing is coloured here, unlike the tank feed: a map change has no buff or
 * nerf side. Each line states what happened in words instead, since a spawn's
 * new coordinates only mean something drawn on the map itself, which is what the
 * map's own history panel is for.
 */
export function MapChangesFeed({
  region,
  versions,
}: {
  region: Region;
  versions: MapFeedVersion[];
}) {
  const entries = useMemo(
    () => versions.flatMap((version) => version.maps.map((map) => ({ version, map }))),
    [versions],
  );
  const { paged, pager } = usePagination(entries, 25);

  if (entries.length === 0) {
    return (
      <Panel>
        <PanelContent className="px-4 py-12 text-center text-sm text-fd-muted-foreground">
          No map changes have been recorded yet. As Wargaming reworks maps, what
          each update changed will appear here.
        </PanelContent>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelContent className="p-0">
        <div className="divide-y divide-fd-border">
          {paged.map((entry, i) => {
            const prev = i > 0 ? paged[i - 1] : null;
            const newVersion =
              !prev || prev.version.gameVersion !== entry.version.gameVersion;
            return (
              <div key={`${entry.version.gameVersion}:${entry.map.arenaId}`}>
                {newVersion ? <VersionHeader version={entry.version} /> : null}
                <MapBlock region={region} map={entry.map} />
              </div>
            );
          })}
        </div>
      </PanelContent>
      <TablePager pager={pager} />
    </Panel>
  );
}

function VersionHeader({ version }: { version: MapFeedVersion }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-fd-border bg-fd-secondary/20 px-4 py-2.5">
      <h2 className="font-heading text-sm font-semibold">
        Update {version.gameVersion}
        <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
          {dateFmt.format(new Date(version.capturedAt))}
        </span>
      </h2>
      <span className="text-xs text-fd-muted-foreground tabular-nums">
        {version.maps.length} map{version.maps.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function MapBlock({ region, map }: { region: Region; map: FeedMap }) {
  const changes = map.changes.map((c) =>
    formatMapChange(c.field, c.previous, c.next),
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
            <span className="text-fd-muted-foreground">{change.label}</span>
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
