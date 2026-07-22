"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerTanksTable } from "@/components/players/detail/tanks/table";
import { TableSkeleton } from "@/components/table-skeleton";
import { TANKS_SKELETON_COLUMNS } from "@/components/players/detail/tanks/skeleton-columns";
import type { PlayerTankRow } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Its own section (not part of Overall) so the ~700-row table isn't
// server-rendered on the default page load, which was the dominant SSR cost.
// The rows load from a separate endpoint on demand when the tab is opened; a
// `?section=tanks` deep-link seeds them from the server render for SEO.
export function TanksTab({
  region,
  nickname,
  vehicles,
  loading,
}: {
  region: Region;
  nickname: string;
  vehicles: PlayerTankRow[];
  loading: boolean;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {nickname}&apos;s tanks
            {loading ? "" : ` (${intFmt.format(vehicles.length)})`}
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {loading ? (
            <TableSkeleton columns={TANKS_SKELETON_COLUMNS} rows={12} />
          ) : (
            <PlayerTanksTable region={region} vehicles={vehicles} />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
