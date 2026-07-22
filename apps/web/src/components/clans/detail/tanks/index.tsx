"use client";

import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { TaggedTitle } from "@/components/clans/detail/tagged-title";
import { ClanVehiclesTable } from "@/components/clans/detail/tanks/table";
import { TableSkeleton } from "@/components/table-skeleton";
import { VEHICLES_SKELETON_COLUMNS } from "@/components/clans/detail/tanks/columns";
import type { ClanVehicleRow } from "@unicum.gg/shared";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** The Tanks section: the clan's per-vehicle aggregate table, or a skeleton
 * while it loads on demand. */
export function ClanTanksTab({
  tag,
  color,
  vehicles,
}: {
  tag: string;
  color: string;
  vehicles: ClanVehicleRow[] | undefined;
}) {
  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            <TaggedTitle tag={tag} color={color}>
              tanks
              {vehicles ? ` (${intFmt.format(vehicles.length)})` : ""}
            </TaggedTitle>
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          {vehicles ? (
            <ClanVehiclesTable vehicles={vehicles} />
          ) : (
            <TableSkeleton columns={VEHICLES_SKELETON_COLUMNS} rows={12} />
          )}
        </PanelContent>
      </Panel>
    </>
  );
}
