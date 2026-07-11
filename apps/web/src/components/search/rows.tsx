"use client";

import Image from "next/image";
import { toRoman } from "roman-numerals";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import { NationFlag } from "@/components/players/nation-flag";
import { TankIcon } from "@/components/players/tank-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import type { ClanSearchResult } from "@unicum.gg/core/wargaming/wot/clans/search";
import type { Region } from "@unicum.gg/wargaming/region";

export function PlayerRow({ player }: { player: SearchPlayerResult }) {
  return (
    <>
      <span className="truncate font-medium">{player.nickname}</span>
      {player.clan ? (
        <span className="shrink-0 font-mono text-xs font-semibold">
          <span style={{ color: player.clan.color }}>[</span>
          {player.clan.tag}
          <span style={{ color: player.clan.color }}>]</span>
        </span>
      ) : null}
    </>
  );
}

export function ClanRow({ clan }: { clan: ClanSearchResult }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {clan.emblem ? (
          <Image
            src={clan.emblem}
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0 rounded-sm"
          />
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <span className="font-mono text-sm font-semibold">
          <span style={{ color: clan.color }}>[</span>
          {clan.tag}
          <span style={{ color: clan.color }}>]</span>
        </span>
        <span className="truncate text-sm text-fd-muted-foreground">
          {clan.name}
        </span>
      </span>
      <span className="shrink-0 text-xs text-fd-muted-foreground">
        {clan.members_count} members
      </span>
    </>
  );
}

export function TankRow({
  tank,
  region,
}: {
  tank: TankSearchResult;
  region: Region;
}) {
  const tier = tank.tier ? toRoman(tank.tier) : String(tank.tier);
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <TankIcon
          region={region}
          tag={tank.tag}
          type={tank.type}
          className="h-4 w-8 shrink-0 object-contain"
        />
        <span
          className={
            tank.is_premium ? "truncate font-medium text-[#FAB81B]" : "truncate font-medium"
          }
        >
          {tank.name}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-fd-muted-foreground">
        <span className="font-semibold text-[#f25322]">{tier}</span>
        <NationFlag nation={tank.nation} region={region} className="h-3" />
        <VehicleTypeIcon type={tank.type} premium={tank.is_premium} className="scale-75" />
      </span>
    </>
  );
}
