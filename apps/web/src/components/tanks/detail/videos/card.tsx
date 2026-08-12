"use client";

import Image from "next/image";
import { useState } from "react";
import {
  BATTLE_RESULT_LABEL,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type BattleResult,
  type MapGameMode,
} from "@unicum.gg/shared";
import { MapPinIcon, PlayIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";
import type { TankVideoGroup } from "./group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTankVideoPlayer } from "./player";

/** One published battle. Shaped like what the endpoint returns rather than
 * importing the server type, so this stays a client component. */
export type TankVideoCardData = {
  id: number;
  videoId: string;
  startSeconds: number;
  title: string;
  channelName: string;
  mapName: string | null;
  mode: MapGameMode | null;
  directionLabel: string | null;
  result: BattleResult | null;
  combinedDamage: number | null;
  gameVersion: string | null;
  /** The tank a battle was played in. Absent on that tank's own page, where
   * every row is the same vehicle and saying so would be noise, and present on
   * the community index, which crosses tanks. */
  tankName?: string;
  tankSlug?: string;
  tankShortName?: string;
  tankTag?: string;
  tier?: number;
  nation?: string;
  type?: string;
  isPremium?: boolean;
  /** Set on the submitter's own rows that a moderator has not settled yet. */
  pending?: boolean;
};

const RESULT_CLASS: Record<string, string> = {
  victory: "text-emerald-500",
  defeat: "text-red-500",
  draw: "text-fd-muted-foreground",
};

/**
 * A video and the battles marked in it, each opening at its own second.
 *
 * A click hands the battle to the page's player, so it plays in the hero at the
 * size a battle is worth watching at rather than in a third of a grid row. The
 * card keeps its own inline player for when there is no provider above it,
 * which is what makes it usable outside the tank page.
 *
 * Either way the iframe only mounts on a click: the thumbnail is a facade, so a
 * page carrying a dozen of these costs a dozen images rather than a dozen
 * embedded players. That is the same reasoning as the lazy chart boundaries, and
 * it matters more here because the count grows with the community.
 */
export function TankVideoCard({
  group,
  region,
}: {
  group: TankVideoGroup;
  /** For the links to the tanks a video covers, on the community index. */
  region: Region;
}) {
  const player = useTankVideoPlayer();
  const [inline, setInline] = useState<TankVideoCardData | null>(null);
  // Which row is lit follows the playhead, not the last click: the player
  // publishes it, since only something mounted beside it can watch its clock.
  const isCurrent = player?.current?.videoId === group.videoId;
  const playingId = isCurrent ? (player?.activeId ?? null) : null;

  const publishedCount = group.battles.filter((b) => !b.pending).length;

  function play(battle: TankVideoCardData) {
    // A pending row is a receipt, not a link: it is only on screen for the
    // person who submitted it, and it is not published until it is reviewed.
    if (battle.pending) return;
    if (player) player.play(battle);
    else setInline(battle);
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-fd-card",
        isCurrent ? "border-brand" : "border-fd-border",
      )}
    >
      <div className="relative aspect-video w-full bg-black">
        {inline ? (
          <iframe
            src={youtubeEmbedUrl(inline.videoId, inline.startSeconds)}
            title={group.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => play(group.battles[0])}
            aria-label={`Play ${group.title}`}
            className="group relative size-full cursor-pointer"
          >
            <Image
              src={youtubeThumbnailUrl(group.videoId)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
              <PlayIcon
                weight="fill"
                className="size-12 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
              />
            </span>
            {/* What the video is worth to someone scanning the tab: how many
                battles of this tank are in it. Published ones only: a row still
                in review is a receipt for its submitter, not something the
                video offers yet. */}
            <span className="absolute right-2 bottom-2 rounded-sm bg-black/80 px-1.5 py-0.5 text-xs text-white">
              {publishedCount} {publishedCount > 1 ? "battles" : "battle"}
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <span className="line-clamp-2 font-medium text-fd-foreground">
          {group.title}
        </span>
        {/* Only on the community index: a tank's own page knows which tank it
            is, and repeating it on every card would be noise. Links rather
            than text, since this is the way back to where the battle belongs. */}
        {group.tanks.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            {group.tanks.map((tank, i) => (
              <span key={tank.slug} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-fd-border">·</span>}
                <Link
                  href={ROUTES.TANK(region, tank.slug)}
                  className="font-medium text-brand hover:underline"
                >
                  {tank.name}
                </Link>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-fd-muted-foreground">
          {/* The channel first: a suggestion exists because someone made the
              video, and the tab is meant to be worth being listed in. */}
          <span className="font-medium">{group.channelName}</span>
          {group.gameVersion && (
            <>
              <span className="text-fd-border">·</span>
              <span>{group.gameVersion}</span>
            </>
          )}
          <span className="text-fd-border">·</span>
          <a
            href={youtubeWatchUrl(group.videoId, 0)}
            target="_blank"
            // Outbound: `nofollow` so a suggested link cannot be used to pass
            // authority, `noopener`/`noreferrer` so the opened tab gets neither
            // a handle on ours nor where it came from.
            rel="nofollow noopener noreferrer"
            className="hover:text-fd-foreground hover:underline"
          >
            Watch on YouTube
          </a>
        </div>

        <ul className="mt-auto flex flex-col pt-1">
          {group.battles.map((battle) => (
            <li key={battle.id}>
              <BattleRow
                battle={battle}
                // Named per row only when the card holds several: with one
                // tank the header already says it.
                showTank={group.tanks.length > 1}
                active={battle.id === playingId}
                onPlay={() => play(battle)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One battle inside a video: where it was played and when it starts. */
function BattleRow({
  battle,
  showTank,
  active,
  onPlay,
}: {
  battle: TankVideoCardData;
  showTank: boolean;
  active: boolean;
  onPlay: () => void;
}) {
  // The map first, since it is what anyone scans for, then how the battle was
  // played, then which side of it they started from.
  const facts = [
    showTank ? battle.tankName : null,
    battle.mapName,
    battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null,
    battle.directionLabel,
  ].filter(Boolean);

  const row = (
    <button
      type="button"
      onClick={onPlay}
      // `aria-disabled`, not `disabled`: a disabled button swallows pointer
      // events, and the tooltip below is the only thing that says why the row
      // is greyed. The click is refused where it is handled instead.
      aria-disabled={battle.pending}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
        battle.pending
          ? "cursor-default text-fd-muted-foreground/50"
          : active
            ? "cursor-pointer bg-brand/10 text-fd-foreground"
            : "cursor-pointer text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground",
      )}
    >
      <MapPinIcon className={cn("size-3.5 shrink-0", active && "text-brand")} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        {facts.map((fact, i) => (
          <span key={fact} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-fd-border">|</span>}
            {fact}
          </span>
        ))}
        {battle.result && (
          <span className={RESULT_CLASS[battle.result]}>
            {BATTLE_RESULT_LABEL[battle.result]}
          </span>
        )}
        {battle.combinedDamage !== null && (
          <span className="tabular-nums">
            {battle.combinedDamage.toLocaleString("en-US")}
            <span className="text-fd-border"> dmg</span>
          </span>
        )}
      </span>
      <span className="ml-auto shrink-0 font-mono tabular-nums">
        {formatTimestamp(battle.startSeconds)}
      </span>
    </button>
  );

  if (!battle.pending) return row;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent>
          Waiting on a moderator. Only you can see it.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
