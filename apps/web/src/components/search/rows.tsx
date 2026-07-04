"use client";

import Image from "next/image";
import type { SearchPlayerResult } from "@/app/api/[region]/players/search/route";
import type { ClanSearchResult } from "@unicum.gg/core/wargaming/wot/clans/search";

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
