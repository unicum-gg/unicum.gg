"use client";

import Image from "next/image";
import {
  BATTLE_RESULT_LABEL,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
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
import { BATTLE_PARAM } from "./battle-param";
import {
  TankDetailTab,
  tankDetailTabHref,
} from "@/components/tanks/detail/tabs";

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
 * On a tank's own page a click hands the battle to the hero, which plays it at
 * the size a battle is worth watching at rather than in a third of a grid row.
 * Anywhere else, where there is no hero to hand it to, the card is a link to
 * that tank's page, opening on the battle clicked.
 *
 * It never embeds a player of its own. A card is a shop window: it belongs on
 * pages carrying a dozen of them, where a dozen iframes would be a dozen
 * players' worth of script for a video nobody has asked for yet, and it would
 * send someone watching a battle away from everything the battle is about.
 * The thumbnail is an image until the click, and the click goes where the video
 * can be watched properly.
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
  // Which row is lit follows the playhead, not the last click: the player
  // publishes it, since only something mounted beside it can watch its clock.
  const isCurrent = player?.current?.videoId === group.videoId;
  const playingId = isCurrent ? (player?.activeId ?? null) : null;

  const publishedCount = group.battles.filter((b) => !b.pending).length;

  // Where a battle is watched when this card has no player above it: the Videos
  // tab of the tank it was played in, opened on that battle. A pending row is a
  // receipt rather than a link, so it leads nowhere: it is only on screen for
  // the person who submitted it, and it is not published yet.
  function watchHref(battle: TankVideoCardData): string | null {
    if (battle.pending || !battle.tankSlug) return null;
    return `${tankDetailTabHref(
      ROUTES.TANK(region, battle.tankSlug),
      TankDetailTab.Videos,
    )}?${BATTLE_PARAM}=${battle.id}`;
  }

  function play(battle: TankVideoCardData) {
    if (battle.pending) return;
    player?.play(battle);
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-fd-card",
        isCurrent ? "border-brand" : "border-fd-border",
      )}
    >
      <div className="relative aspect-video w-full bg-black">
        <Thumbnail
          title={group.title}
          onPlay={player ? () => play(group.battles[0]) : undefined}
          href={watchHref(group.battles[0])}
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
        </Thumbnail>
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
                onPlay={player ? () => play(battle) : undefined}
                href={watchHref(battle)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The video's own picture, and what a click on it does.
 *
 * A button beside a hero that can play it, a link everywhere else, and neither
 * when the only battle it holds is still in review. The three share their
 * inside, so the picture is written once.
 */
function Thumbnail({
  title,
  onPlay,
  href,
  children,
}: {
  title: string;
  onPlay?: () => void;
  href: string | null;
  children: React.ReactNode;
}) {
  const className = "group relative block size-full";
  if (onPlay)
    return (
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${title}`}
        className={cn(className, "cursor-pointer")}
      >
        {children}
      </button>
    );
  if (href)
    return (
      <Link href={href} aria-label={`Watch ${title}`} className={className}>
        {children}
      </Link>
    );
  return <span className={className}>{children}</span>;
}

/** One battle inside a video: where it was played and when it starts. */
function BattleRow({
  battle,
  showTank,
  active,
  onPlay,
  href,
}: {
  battle: TankVideoCardData;
  showTank: boolean;
  active: boolean;
  /** Given where a hero can play the battle in place. Without it the row is a
   * link to the tank's page, which is where it can be watched. */
  onPlay?: () => void;
  href: string | null;
}) {
  // The map first, since it is what anyone scans for, then how the battle was
  // played, then which side of it they started from.
  const facts = [
    showTank ? battle.tankName : null,
    battle.mapName,
    battle.mode ? MAP_GAME_MODE_LABEL[battle.mode] : null,
    battle.directionLabel,
  ].filter(Boolean);

  const className = cn(
    "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
    battle.pending
      ? "cursor-default text-fd-muted-foreground/50"
      : active
        ? "cursor-pointer bg-brand/10 text-fd-foreground"
        : "cursor-pointer text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground",
  );

  const inside = (
    <>
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
    </>
  );

  const row = onPlay ? (
    <button
      type="button"
      onClick={onPlay}
      // `aria-disabled`, not `disabled`: a disabled button swallows pointer
      // events, and the tooltip below is the only thing that says why the row
      // is greyed. The click is refused where it is handled instead.
      aria-disabled={battle.pending}
      className={className}
    >
      {inside}
    </button>
  ) : href ? (
    <Link href={href} className={className}>
      {inside}
    </Link>
  ) : (
    // Nowhere to go and nothing to play: a queued row, which only its submitter
    // sees and which the tooltip below explains.
    <span className={className}>{inside}</span>
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
