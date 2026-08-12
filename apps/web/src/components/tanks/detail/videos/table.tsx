"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BATTLE_FORMAT_LABEL, MAP_GAME_MODE_LABEL } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { BATTLE_PARAM } from "@/components/tanks/detail/videos/battle-param";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import {
  SortDirection,
  SortHead,
  type SortState,
} from "@/components/tanks/list/sorting";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import type { TankVideoCardData } from "./card";
import { VideoTableRow, type VideoColumns } from "./table-row";
import { useTankVideoPlayer } from "./player";

function sortValue(
  battle: TankVideoCardData,
  key: string,
): number | string | null {
  switch (key) {
    case "nation":
      return battle.nation ?? null;
    case "type":
      return battle.type ?? null;
    case "tier":
      return battle.vehicleTier ?? null;
    case "tank":
      return (
        battle.tankShortName || battle.tankName || battle.clan?.tag || null
      );
    case "map":
      return battle.mapName;
    case "format":
      return battle.format ? BATTLE_FORMAT_LABEL[battle.format] : null;
    case "mode":
      return battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null;
    case "spawn":
      return battle.directionLabel;
    case "result":
      return battle.result;
    case "channel":
      return battle.channelName;
    case "published":
      return battle.publishedAt ? new Date(battle.publishedAt).getTime() : null;
    default:
      return battle.combinedDamage;
  }
}

/**
 * The Videos tab as a table, built like the tank list beside it: the same
 * identity columns (nation, class, tier, vehicle) so a battle is read the way a
 * vehicle is, then what happened in it.
 *
 * A row is a battle rather than a video. A table exists to be sorted, and a
 * recording holding three battles has three maps and three damage figures to
 * sort on, which one row per video could not express.
 *
 * There is no column for the video or its timestamp: the title repeats down the
 * whole table and the second it starts at is not something anyone ranks by. It
 * is the play button at the end of the row, which is what the timestamp is
 * actually for.
 */
export function VideosTable({
  region,
  battles,
  showTank,
  showMap = true,
  onPlay,
}: {
  region: Region;
  battles: TankVideoCardData[];
  /** Whether the rows cross tanks. On one tank's own page they do not, and four
   * columns repeating the same vehicle are four columns of nothing. */
  showTank: boolean;
  /** Whether the rows cross maps. On one map's own page they do not, for the
   * same reason. */
  showMap?: boolean;
  /** Given on a tank's own page, where the hero can play the battle in place.
   * Without it the row links to the tank's page instead, which is the only way
   * to watch it from the community index. */
  onPlay?: (battle: TankVideoCardData) => void;
}) {
  // Which row is playing, when there is a hero above to play it. Read from the
  // player rather than from the click, so it follows the playhead into the next
  // battle of the same video, exactly like the cards.
  const activeId = useTankVideoPlayer()?.activeId ?? null;
  const router = useRouter();

  // A column is drawn where at least one row has something to put in it. The
  // same table serves the community index, a tank's page and a map's two lists,
  // and each of those leaves a different set of columns empty: a tactic has no
  // vehicle and no damage, a tank page has nothing but its own vehicle. A
  // column of dashes is a column that says nothing.
  const showClan = battles.some((b) => b.clan);
  const hasTanks = battles.some((b) => b.tankSlug);
  const showVehicle = showTank && hasTanks;
  const showIdentity = showTank && battles.some((b) => b.tankSlug || b.clan);
  const showDamage = battles.some((b) => b.combinedDamage != null);
  const showPublished = battles.some((b) => b.publishedAt);

  /** Where a row is watched when this table has no player beside it: the page
   * the battle belongs to, opened on it. A tactic has no vehicle, so it goes to
   * the ground it was fought on rather than to a tank URL with an empty slug. */
  function watchHref(battle: TankVideoCardData): string | null {
    if (battle.tankSlug) {
      return `${tankDetailTabHref(
        ROUTES.TANK(region, battle.tankSlug),
        TankDetailTab.Videos,
      )}?${BATTLE_PARAM}=${battle.id}`;
    }
    if (battle.mapSlug) {
      return `${ROUTES.MAP(region, battle.mapSlug)}?${BATTLE_PARAM}=${battle.id}`;
    }
    return null;
  }

  /** What a click on a row does: hand the battle to the player beside it where
   * there is one, and otherwise go to the page that has one. */
  function open(battle: TankVideoCardData) {
    if (onPlay) return onPlay(battle);
    const href = watchHref(battle);
    if (href) router.push(href);
  }

  // Decided once, and handed to every row.
  const columns: VideoColumns = {
    vehicle: showVehicle,
    identity: showIdentity,
    map: showMap,
    damage: showDamage,
    published: showPublished,
  };

  const [sort, setSort] = useState<SortState>({
    // Damage where there is any, and what was played otherwise: a tactics table
    // has no numbers to rank by.
    key: showDamage ? "damage" : "format",
    direction: SortDirection.Desc,
  });

  function toggle(key: string) {
    setSort((s) =>
      s.key === key
        ? {
            key,
            direction:
              s.direction === SortDirection.Asc
                ? SortDirection.Desc
                : SortDirection.Asc,
          }
        : { key, direction: SortDirection.Desc },
    );
  }

  const rows = useMemo(() => {
    const sorted = [...battles];
    sorted.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      // Missing values sink whichever way the column is sorted: an unknown map
      // is not the smallest map.
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.direction === SortDirection.Asc ? cmp : -cmp;
    });
    return sorted;
  }, [battles, sort]);

  return (
    <TooltipProvider>
      {/* Same edge padding and row density as the other list tables: the
          primitive runs its cells flush to the panel, so first and last columns
          get theirs back explicitly, headers included. */}
      <div className="overflow-x-auto">
        <Table className="my-0! [&_td]:py-1.5! [&_th]:whitespace-nowrap [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child>button]:pl-4! [&_thead_th:last-child>button]:pr-4!">
          <TableHeader>
            <TableRow>
              {showVehicle && (
                <>
                  <SortHead
                    sort={sort}
                    col="nation"
                    onToggle={toggle}
                    align="center"
                  >
                    <span className="sr-only">Nation</span>
                  </SortHead>
                  <SortHead
                    sort={sort}
                    col="type"
                    onToggle={toggle}
                    align="center"
                  >
                    <span className="sr-only">Class</span>
                  </SortHead>
                  <SortHead
                    sort={sort}
                    col="tier"
                    onToggle={toggle}
                    align="center"
                  >
                    Tier
                  </SortHead>
                </>
              )}
              {showIdentity && (
                <SortHead sort={sort} col="tank" onToggle={toggle}>
                  {/* One column for both, because a row is one or the other: a
                      random battle is about the vehicle it was played in, a
                      tactic about the clan that played it, and neither ever
                      wants the other's name in a column of its own. The heading
                      names what is actually in it, so a tactics table says
                      "Clan" rather than offering a word for something none of
                      its rows have. */}
                  {hasTanks && showClan
                    ? "Tank / Clan"
                    : showClan
                      ? "Clan"
                      : "Tank"}
                </SortHead>
              )}
              {showMap && (
                <SortHead sort={sort} col="map" onToggle={toggle}>
                  Map
                </SortHead>
              )}
              <SortHead sort={sort} col="format" onToggle={toggle}>
                Format
              </SortHead>
              <SortHead sort={sort} col="mode" onToggle={toggle}>
                Mode
              </SortHead>
              <SortHead sort={sort} col="spawn" onToggle={toggle}>
                Spawn
              </SortHead>
              <SortHead sort={sort} col="result" onToggle={toggle}>
                Result
              </SortHead>
              {showDamage && (
                <SortHead
                  sort={sort}
                  col="damage"
                  onToggle={toggle}
                  align="end"
                  tip="Damage dealt plus assisted, as declared by the submitter."
                >
                  Combined
                </SortHead>
              )}
              <SortHead sort={sort} col="channel" onToggle={toggle}>
                Channel
              </SortHead>
              {showPublished && (
                <SortHead sort={sort} col="published" onToggle={toggle}>
                  Published
                </SortHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((battle) => (
              <VideoTableRow
                key={battle.id}
                battle={battle}
                region={region}
                columns={columns}
                active={battle.id === activeId}
                onOpen={() => open(battle)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
