"use client";

import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { useMemo } from "react";
import {
  type FeedMap,
  MapBlock,
} from "@/components/maps/list/changes/map-block";
import { Panel, PanelContent } from "@/components/panel";
import { TablePager, usePagination } from "@/components/table-pager";
import type { Region } from "@unicum.gg/wargaming";

export type MapFeedVersion = {
  gameVersion: string;
  capturedAt: string | Date;
  maps: FeedMap[];
};

const DATE_PATTERN = "d MMM yyyy";

/**
 * The global map-changes feed: every map an update touched, grouped by game
 * version (newest first) then by map (most-changed first).
 *
 * Only what shipped. What the running Common Test is about to change sits in its
 * own panel above, since it is not history and can still be re-cut or dropped.
 */
export function MapChangesFeed({
  region,
  versions,
}: {
  region: Region;
  versions: MapFeedVersion[];
}) {
  const { t } = useTranslation("components/maps/list/changes/feed");
  const entries = useMemo(
    () => versions.flatMap((version) => version.maps.map((map) => ({ version, map }))),
    [versions],
  );
  const { paged, pager } = usePagination(entries, 25);

  if (entries.length === 0) {
    return (
      <Panel>
        <PanelContent className="px-4 py-12 text-center text-sm text-fd-muted-foreground">
          {t("no-map-changes-have-been")}</PanelContent>
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
  const { date } = useFormat();
  const { t } = useTranslation("components/maps/list/changes/feed");
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-fd-border bg-fd-secondary/20 px-4 py-2.5">
      <h2 className="font-heading text-sm font-semibold">
        {t("update", { version: version.gameVersion })}
        <span className="ml-2 text-xs font-normal text-fd-muted-foreground">
          {date(DATE_PATTERN).format(new Date(version.capturedAt))}
        </span>
      </h2>
      <span className="text-xs text-fd-muted-foreground tabular-nums">
        {t("n-maps", { count: version.maps.length })}
      </span>
    </div>
  );
}
