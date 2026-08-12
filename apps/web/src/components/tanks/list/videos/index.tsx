"use client";

import { useMemo } from "react";
import type { Region } from "@unicum.gg/wargaming";
import { Panel, PanelContent } from "@/components/panel";
import { TankVideoCard } from "@/components/tanks/detail/videos/card";
import { groupBattlesByVideo } from "@/components/tanks/detail/videos/group";
import { BattleFilterBar } from "@/components/tanks/detail/videos/battle-filter-bar";
import { useBattleFilters } from "@/components/tanks/detail/videos/battle-filters";
import { TankFilterBar } from "@/components/tanks/tank-filter-bar";
import { TankTab } from "@/components/tanks/list/tabs";
import { TanksTabNav } from "@/components/tanks/list/tab-nav";
import { VideosTable } from "@/components/tanks/detail/videos/table";
import {
  useVideosView,
  VideosView,
  VideosViewToggle,
} from "@/components/tanks/detail/videos/view-toggle";
import type { CommunityBattle } from "@/components/tanks/list/videos/row";
import { type RangeColumn, useTankFilters } from "@/hooks/use-tank-filters";

// The one number a battle carries. Everything else about a row is the vehicle,
// which the tier/nation/class filters already cover.
const RANGE_COLS: RangeColumn<CommunityBattle>[] = [
  { key: "damage", label: "Combined", value: (b) => b.combinedDamage },
];

/**
 * The Videos tab of the tank index: every battle the community has linked,
 * whatever the tank.
 *
 * Two views of the same rows, because they answer different questions. The
 * cards are for watching, one per video with its battles beneath and a player
 * in place. The table is for finding: a row per battle, presented like the tank
 * list and sortable by tier, map or damage, which a grid of thumbnails cannot
 * do.
 *
 * The filter bar is the tank list's own: a row carries its vehicle's tier,
 * nation, class and role, so filtering by them needs no second implementation,
 * and it applies to both views.
 */
export function TanksVideosTab({
  region,
  battles,
  basePath,
}: {
  region: Region;
  battles: CommunityBattle[];
  basePath: string;
}) {
  const [view, setView] = useVideosView();

  // Two filter bars, because the rows have two halves. The tank list's own
  // covers the vehicle (tier, nation, class), and the battle one covers what
  // was played: a tactic has no vehicle at all, so without the second it could
  // only ever be found by scrolling.
  const { filtered, filters } = useTankFilters(battles, RANGE_COLS, "damage");
  const battleState = useBattleFilters(filtered);
  const groups = useMemo(
    () => groupBattlesByVideo(battleState.filtered),
    [battleState.filtered],
  );

  return (
    <Panel>
      <TanksTabNav active={TankTab.Videos} basePath={basePath} />
      <PanelContent className="space-y-4 p-4">
        <TankFilterBar
          filters={filters}
          searchNoun="videos"
          extra={<VideosViewToggle view={view} onChange={setView} />}
        />
        <BattleFilterBar {...battleState} />
      </PanelContent>

      {battleState.filtered.length === 0 ? (
        <div className="border-t border-fd-border">
          <p className="py-12 text-center text-sm text-fd-muted-foreground">
            {battles.length === 0
              ? "No video yet. They arrive from the pages they belong to: a battle from its tank's page, a tactic from the map it was fought on."
              : "No battle matches these filters."}
          </p>
        </div>
      ) : view === VideosView.Table ? (
        <div className="border-t border-fd-border">
          <VideosTable
            region={region}
            battles={battleState.filtered}
            showTank
          />
        </div>
      ) : (
        <PanelContent className="p-4 pt-0">
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <TankVideoCard key={group.videoId} group={group} region={region} />
            ))}
          </div>
        </PanelContent>
      )}
    </Panel>
  );
}
