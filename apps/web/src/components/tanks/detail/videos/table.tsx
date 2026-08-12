"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toRoman } from "roman-numerals";
import { PlayIcon } from "@phosphor-icons/react";
import {
  BATTLE_RESULT_LABEL,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { BATTLE_PARAM } from "@/components/tanks/detail/videos/battle-param";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  SortDirection,
  SortHead,
  type SortState,
} from "@/components/tanks/list/sorting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { TankVideoCardData } from "./card";
import { useTankVideoPlayer } from "./player";

const RESULT_CLASS: Record<string, string> = {
  victory: "text-emerald-500",
  defeat: "text-red-500",
  draw: "text-fd-muted-foreground",
};

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
      return battle.tier ?? null;
    case "tank":
      return battle.tankShortName || battle.tankName || null;
    case "map":
      return battle.mapName;
    case "mode":
      return battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null;
    case "spawn":
      return battle.directionLabel;
    case "result":
      return battle.result;
    case "channel":
      return battle.channelName;
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
  onPlay,
}: {
  region: Region;
  battles: TankVideoCardData[];
  /** Whether the rows cross tanks. On one tank's own page they do not, and four
   * columns repeating the same vehicle are four columns of nothing. */
  showTank: boolean;
  /** Given on a tank's own page, where the hero can play the battle in place.
   * Without it the row links to the tank's page instead, which is the only way
   * to watch it from the community index. */
  onPlay?: (battle: TankVideoCardData) => void;
}) {
  // Which row is playing, when there is a hero above to play it. Read from the
  // player rather than from the click, so it follows the playhead into the next
  // battle of the same video, exactly like the cards.
  const activeId = useTankVideoPlayer()?.activeId ?? null;

  const [sort, setSort] = useState<SortState>({
    key: "damage",
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
              {showTank && (
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
                  <SortHead sort={sort} col="tank" onToggle={toggle}>
                    Tank
                  </SortHead>
                </>
              )}
              <SortHead sort={sort} col="map" onToggle={toggle}>
                Map
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
              <SortHead
                sort={sort}
                col="damage"
                onToggle={toggle}
                align="end"
                tip="Damage dealt plus assisted, as declared by the submitter."
              >
                Combined
              </SortHead>
              <SortHead sort={sort} col="channel" onToggle={toggle}>
                Channel
              </SortHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((battle) => (
              <TableRow
                key={battle.id}
                className={cn(
                  battle.pending && "text-fd-muted-foreground/50",
                  battle.id === activeId && "bg-brand/10 text-fd-foreground",
                )}
              >
                {showTank && (
                  <>
                    <TableCell className="text-center">
                      <NationFlag nation={battle.nation ?? ""} region={region} />
                    </TableCell>
                    <TableCell className="text-center">
                      <VehicleTypeIcon
                        type={battle.type ?? ""}
                        premium={battle.isPremium}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-medium tabular-nums",
                        battle.isPremium && "text-[#FAB81B]",
                      )}
                    >
                      {battle.tier ? toRoman(battle.tier) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium",
                        battle.isPremium && "text-[#FAB81B]",
                      )}
                    >
                      {/* Carries the battle too: someone clicking the tank still
                          wants this video, they just want the tank's page rather
                          than its videos tab, and the hero plays it there too. */}
                      <Link
                        href={`${ROUTES.TANK(region, battle.tankSlug ?? "")}?${BATTLE_PARAM}=${battle.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <TankIcon
                          region={region}
                          tag={battle.tankTag ?? ""}
                          type={battle.type ?? ""}
                          className="h-3.5 w-auto shrink-0 object-contain"
                        />
                        <span className="min-w-0 truncate">
                          {battle.tankShortName || battle.tankName}
                        </span>
                      </Link>
                    </TableCell>
                  </>
                )}
                <TableCell>{battle.mapName ?? "—"}</TableCell>
                <TableCell>
                  {battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : "—"}
                </TableCell>
                <TableCell>{battle.directionLabel ?? "—"}</TableCell>
                <TableCell
                  className={cn(battle.result && RESULT_CLASS[battle.result])}
                >
                  {battle.result ? BATTLE_RESULT_LABEL[battle.result] : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {battle.combinedDamage?.toLocaleString("en-US") ?? "—"}
                </TableCell>
                <TableCell className="text-fd-muted-foreground">
                  {battle.channelName}
                </TableCell>
                <TableCell className="text-right">
                  {/* To the tank's own page rather than to YouTube: it opens on
                      this battle, in the hero, next to the other battles of the
                      same video and to the tank it was played in. */}
                  {battle.pending ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex text-fd-muted-foreground/40">
                          <PlayIcon weight="fill" className="size-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Waiting on a moderator. Only you can see it.
                      </TooltipContent>
                    </Tooltip>
                  ) : onPlay ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onPlay(battle)}
                          aria-label={`Watch at ${formatTimestamp(battle.startSeconds)}`}
                          className="inline-flex cursor-pointer text-fd-muted-foreground transition-colors hover:text-brand"
                        >
                          <PlayIcon weight="fill" className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Opens at {formatTimestamp(battle.startSeconds)}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`${tankDetailTabHref(
                            ROUTES.TANK(region, battle.tankSlug ?? ""),
                            TankDetailTab.Videos,
                          )}?${BATTLE_PARAM}=${battle.id}`}
                          aria-label={`Watch at ${formatTimestamp(battle.startSeconds)}`}
                          className="inline-flex text-fd-muted-foreground transition-colors hover:text-brand"
                        >
                          <PlayIcon weight="fill" className="size-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        Opens at {formatTimestamp(battle.startSeconds)}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
