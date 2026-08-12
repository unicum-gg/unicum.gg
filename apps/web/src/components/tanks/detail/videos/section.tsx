"use client";

import type { Region } from "@unicum.gg/wargaming";
import { PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { TankVideoCard, type TankVideoCardData } from "./card";
import { BattleFilterBar } from "./battle-filter-bar";
import { useBattleFilters } from "./battle-filters";
import { groupBattlesByVideo } from "./group";
import { useTankVideoPlayer } from "./player";
import { VideosTable } from "./table";
import { VideosView, VideosViewToggle } from "./view-toggle";

/**
 * One list of battles, with its own filters.
 *
 * The unit every page below the tank pages is built from: a map's tactics, a
 * map's random battles, a clan's published record. They differ by which rows
 * they are handed and what the heading says, never by what a list is.
 *
 * The map page renders two of them, because it answers two different questions
 * with the same rows. The tactics are a shot-caller's library: what was played,
 * from which side, by whom. The random battles are the map seen played well,
 * which is a thing to watch rather than a thing to prepare from. Mixed into one
 * list they got in each other's way, and the format filter was the only thing
 * telling them apart.
 */
export function VideoSection({
  region,
  title,
  battles,
  view,
  onViewChange,
  emptyText,
  action,
  showMap = false,
}: {
  region: Region;
  title: string;
  battles: TankVideoCardData[];
  view: VideosView;
  /** Given on the section that carries the toggle. Both lists follow the same
   * preference, so only one of them draws it. */
  onViewChange?: (view: VideosView) => void;
  emptyText: string;
  /** The submit button, on the section that accepts submissions. */
  action?: React.ReactNode;
  /** Whether the rows cross maps. A map's own lists do not; a clan's record
   * does, and there the map is the first thing worth reading. */
  showMap?: boolean;
}) {
  const player = useTankVideoPlayer();
  const state = useBattleFilters(battles);
  const groups = groupBattlesByVideo(state.filtered);
  // A single battle has nothing to filter, so the bar would be an empty row.
  // What follows it owes the panel one gap, not two, hence the `pt-0` below,
  // which only applies when the bar is there to have paid it.
  const showFilters = state.active || battles.length > 1;
  const belowFilters = showFilters ? "pt-0" : undefined;

  return (
    <>
      <PanelHeader className="flex flex-wrap items-center gap-3">
        <PanelTitle>{title}</PanelTitle>
        {battles.length > 0 && (
          <span className="text-sm text-fd-muted-foreground">
            {state.filtered.length === battles.length
              ? battles.length
              : `${state.filtered.length} of ${battles.length}`}
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {onViewChange && battles.length > 0 && (
            <VideosViewToggle view={view} onChange={onViewChange} />
          )}
          {action}
        </span>
      </PanelHeader>

      {showFilters ? (
        <PanelContent>
          <BattleFilterBar {...state} />
        </PanelContent>
      ) : null}

      {state.filtered.length === 0 ? (
        <PanelContent className={belowFilters}>
          <p className="py-8 text-center text-sm text-fd-muted-foreground">
            {battles.length === 0 ? emptyText : "No battle matches these filters."}
          </p>
        </PanelContent>
      ) : view === VideosView.Table ? (
        // Edge to edge, like the other tables on the site. The play button
        // hands the battle to the player above rather than sending anyone to
        // another page.
        <div className="border-t border-fd-border">
          <VideosTable
            region={region}
            battles={state.filtered}
            showTank
            showMap={showMap}
            onPlay={(battle) => player?.play(battle)}
          />
        </div>
      ) : (
        <PanelContent className={belowFilters}>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <TankVideoCard key={g.videoId} group={g} region={region} />
            ))}
          </div>
        </PanelContent>
      )}
    </>
  );
}
