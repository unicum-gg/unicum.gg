"use client";

import { Panel, PanelContent } from "@/components/panel";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { useTankFilters, type RangeColumn } from "@/hooks/use-tank-filters";
import type { Region } from "@unicum.gg/wargaming";
import { CommunityTable } from "./table";
import type { CommunityBoardRow } from "./row";

/**
 * The board's shell: the catalogue's own filter bar over the ratings table.
 *
 * Same construction as the tanks list (`components/tanks/list/index.tsx`): the
 * filters live up here and hand the narrowed rows down, the bar sits in its own
 * padded `PanelContent`, and the table hangs below a rule with no padding of
 * its own, because it carries its own edge insets and its own footer.
 *
 * Reusing `useTankFilters` rather than writing a second one is the point: tier,
 * nation, class, role and category behave here exactly as they do on the stats
 * tables, so nobody has to learn a second way to narrow a list of tanks. Only
 * the range control is repointed, at these columns.
 */

/** The numeric columns the min/max range control can target, so someone can ask
 * for "tanks rated above 4 with at least fifty votes" without a second filter
 * concept. */
const RANGE_COLUMNS: RangeColumn<CommunityBoardRow>[] = [
  { key: "overall", label: "Overall", value: (t) => t.overall },
  { key: "fun", label: "Fun", value: (t) => t.fun },
  { key: "votes", label: "Votes", value: (t) => t.votes },
  {
    key: "hype",
    label: "Reputation gap",
    // Scaled to whole points, matching the column: typing 0.25 into a box next
    // to a cell reading "+25" is a trap.
    value: (t) => (t.hype == null ? null : t.hype * 100),
  },
];

export function CommunityBoard({
  region,
  rows,
}: {
  region: Region;
  rows: CommunityBoardRow[];
}) {
  const { filtered, filters } = useTankFilters(rows, RANGE_COLUMNS, "overall");

  return (
    <Panel>
      <PanelContent className="space-y-4 p-4">
        <TankFilterBar filters={filters} searchNoun="rated tanks" />
      </PanelContent>
      <div className="border-t border-fd-border">
        <CommunityTable region={region} rows={filtered} />
      </div>
    </Panel>
  );
}
