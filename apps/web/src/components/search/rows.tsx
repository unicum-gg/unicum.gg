"use client";

import { BookOpenIcon } from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { TankSearchResult } from "@/app/api/[region]/tanks/search/route";
import type { MapSearchResult } from "@/app/api/[region]/maps/search/route";
import { CAMO_META } from "@/components/maps/meta";
import { MinimapImage } from "@/components/maps/minimap-image";
import { PlayerName } from "@/components/entity/player-name";
import { ClanName } from "@/components/entity/clan-name";
import { clanIdentityFromRow } from "@/components/entity/clan-identity";
import { identityFromRow } from "@/components/entity/player-identity";
import { NationFlag } from "@/components/tanks/nation-flag";
import { TankIcon } from "@/components/tanks/tank-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import { cn } from "@/lib/utils";
import type { ClanSearchResult, GlossarySummary } from "@unicum.gg/shared";
import {
  glossaryAcronym,
  GLOSSARY_CATEGORY_LABEL,
  type MapCamouflage,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** `link` is off: the row itself is the click target and picks the result. The
 * crests keep their own links, which the row can hold now that it is an option
 * rather than a button. */
export function PlayerRow({
  player,
  region,
}: {
  player: SearchPlayerResult;
  region: Region;
}) {
  return (
    <PlayerName
      region={region}
      link={false}
      player={{
        ...identityFromRow(player),
        clanTag: player.clan?.tag,
        clanColor: player.clan?.color,
      }}
    />
  );
}

export function ClanRow({
  clan,
  region,
}: {
  clan: ClanSearchResult;
  region: Region;
}) {
  return (
    <>
      {/* `link` off: the dialog already wraps the row in one, and a rank crest
          is itself a link. */}
      <ClanName
        region={region}
        link={false}
        clan={clanIdentityFromRow(clan)}
        showEmblem
        showName
        size={14}
        tagClassName="text-sm"
        nameClassName="text-sm"
      />
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

export function GlossaryRow({ term }: { term: GlossarySummary }) {
  const acronym = glossaryAcronym(term);
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <BookOpenIcon className="size-4 shrink-0 text-fd-muted-foreground" />
        {/* Holds its width against the definition beside it (two plain
            `truncate` siblings share the shrinking, which clipped "Gun arc"
            to "Gun..." with half the row empty), but capped and truncatable so
            the longest names in the catalogue, past thirty characters, cannot
            push the category and the favorite star off a phone-width row. */}
        <span className="shrink-0 truncate font-medium max-w-[60%]">
          {term.term}
        </span>
        {acronym ? (
          <span className="shrink-0 text-xs text-fd-muted-foreground">
            {acronym}
          </span>
        ) : null}
        <span className="hidden truncate text-sm text-fd-muted-foreground sm:inline">
          {term.short}
        </span>
      </span>
      <span className="shrink-0 text-xs text-fd-muted-foreground">
        {GLOSSARY_CATEGORY_LABEL[term.category]}
      </span>
    </>
  );
}
