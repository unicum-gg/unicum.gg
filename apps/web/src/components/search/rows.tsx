"use client";

import Image from "next/image";
import { toRoman } from "roman-numerals";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import type { MapSearchResult } from "@/app/api/[region]/maps/search/route";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapImage } from "@/components/maps/minimap-image";
import { ClanTag } from "@/components/entity/clan-tag";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { cn } from "@/lib/utils";
import type { ClanSearchResult } from "@unicum.gg/shared";
import { type MapCamouflage } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

export function PlayerRow({ player }: { player: SearchPlayerResult }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate font-medium">{player.nickname}</span>
      {player.clan ? (
        <ClanTag
          tag={player.clan.tag}
          color={player.clan.color}
          className="shrink-0 font-mono text-xs font-semibold"
        />
      ) : null}
      {player.is_verified && <VerifiedBadge />}
      {player.is_supporter && (
        <SupporterBadge state={SupporterBadgeState.Active} />
      )}
      {player.twitch_login && <StreamerBadge login={player.twitch_login} />}
    </span>
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
        <ClanTag
          tag={clan.tag}
          color={clan.color}
          className="font-mono text-sm font-semibold"
        />
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
          nation={tank.nation}
          isCommonTest={tank.is_common_test}
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
        <span className="font-semibold text-brand">{tier}</span>
        <NationFlag nation={tank.nation} region={region} className="h-3" />
        <VehicleTypeIcon type={tank.type} premium={tank.is_premium} className="scale-75" />
      </span>
    </>
  );
}

export function MapRow({ map }: { map: MapSearchResult }) {
  const camo = CAMO_META[map.camouflage as MapCamouflage];
  const CamoIcon = camo.icon;
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span className="relative size-6 shrink-0 overflow-hidden rounded-sm bg-fd-muted">
          <MinimapImage
            src={map.minimap_url}
            arenaId={map.arena_id}
            alt=""
            sizes="24px"
          />
        </span>
        <span className="truncate font-medium">{map.name}</span>
      </span>
      <span className={cn("shrink-0", camo.className)} title={`${camo.label} map`}>
        <CamoIcon weight="fill" className="size-3.5" />
      </span>
    </>
  );
}
