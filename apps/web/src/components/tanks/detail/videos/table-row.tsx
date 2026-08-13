"use client";

import Image from "next/image";
import Link from "next/link";
import { toRoman } from "roman-numerals";
import {
  BATTLE_FORMAT_LABEL,
  BATTLE_RESULT_LABEL,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { ClanTag } from "@/components/entity/clan-tag";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import { BATTLE_PARAM } from "./battle-param";
import type { TankVideoCardData } from "./card";

const RESULT_CLASS: Record<string, string> = {
  victory: "text-emerald-500",
  defeat: "text-red-500",
  draw: "text-fd-muted-foreground",
};

/** Which columns this row draws. The table decides once, from what its rows
 * actually carry, and every row follows: a column present on one and absent on
 * the next would not be a table. */
export type VideoColumns = {
  vehicle: boolean;
  identity: boolean;
  map: boolean;
  damage: boolean;
};

/**
 * One battle, as a row that opens it.
 *
 * The whole row is the button: a row that opens a video has one action, and
 * putting it in a 40px cell at the far end made the other nine columns look
 * like decoration. The tank keeps a link of its own, stopped so the vehicle's
 * page wins rather than both firing.
 */
export function VideoTableRow({
  battle,
  region,
  columns,
  active,
  onOpen,
}: {
  battle: TankVideoCardData;
  region: Region;
  columns: VideoColumns;
  active: boolean;
  onOpen: () => void;
}) {
  const row = (
    <TableRow
      key={battle.id}
      // The whole row is the play button. A row that opens a video
      // has one action, and putting it in a 40px cell at the far end
      // made the other nine columns look like decoration.
      role="button"
      tabIndex={0}
      onClick={() => onOpen()}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
      aria-label={`Watch at ${formatTimestamp(battle.startSeconds)}`}
      className={cn(
        "cursor-pointer",
        battle.pending && "text-fd-muted-foreground/50",
        active && "bg-brand/10 text-fd-foreground",
      )}
    >
      {columns.vehicle && (
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
            {battle.vehicleTier ? toRoman(battle.vehicleTier) : "—"}
          </TableCell>
        </>
      )}
      {columns.identity && (
        <TableCell
          className={cn("font-medium", battle.isPremium && "text-[#FAB81B]")}
        >
          {battle.tankSlug ? (
            // Carries the battle too: someone clicking the tank
            // still wants this video, they just want the tank's
            // page rather than its videos tab, and the hero plays
            // it there too.
            <Link
              href={`${ROUTES.TANK(region, battle.tankSlug)}?${BATTLE_PARAM}=${battle.id}`}
              // Stopped, so the vehicle's page wins over the row's
              // own action rather than both firing.
              onClick={(event) => event.stopPropagation()}
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
          ) : battle.clan ? (
            // Text, not a link: the row owns the click, and a second
            // destination inside it would be a coin toss. The site's
            // own tag, so the brackets still carry the clan's colour.
            <span className="flex items-center gap-2">
              {battle.clan.emblem && (
                <Image
                  src={battle.clan.emblem}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 shrink-0 rounded"
                />
              )}
              <ClanTag tag={battle.clan.tag} color={battle.clan.color} />
            </span>
          ) : (
            <span className="text-fd-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      {columns.map && <TableCell>{battle.mapName ?? "—"}</TableCell>}
      <TableCell>
        {battle.format ? BATTLE_FORMAT_LABEL[battle.format] : "—"}
      </TableCell>
      <TableCell>
        {battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : "—"}
      </TableCell>
      <TableCell>{battle.directionLabel ?? "—"}</TableCell>
      <TableCell className={cn(battle.result && RESULT_CLASS[battle.result])}>
        {battle.result ? BATTLE_RESULT_LABEL[battle.result] : "—"}
      </TableCell>
      {columns.damage && (
        <TableCell className="text-right tabular-nums">
          {battle.combinedDamage?.toLocaleString("en-US") ?? "—"}
        </TableCell>
      )}
      <TableCell className="text-fd-muted-foreground">
        {battle.channelName}
      </TableCell>
    </TableRow>
  );

  if (!battle.pending) return row;
  // The greying says a row is not live yet; this says why. It used to hang off
  // the play button, which the row absorbed.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent>
        Waiting on a moderator. Only you can see it.
      </TooltipContent>
    </Tooltip>
  );
}
