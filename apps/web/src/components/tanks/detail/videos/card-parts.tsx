"use client";

import Link from "next/link";
import {
  BATTLE_RESULT_LABEL,
  formatTimestamp,
  MAP_GAME_MODE_LABEL,
} from "@unicum.gg/shared";
import { MapPinIcon } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TankVideoCardData } from "./card";

const RESULT_CLASS: Record<string, string> = {
  victory: "text-emerald-500",
  defeat: "text-red-500",
  draw: "text-fd-muted-foreground",
};

/**
 * The video's own picture, and what a click on it does.
 *
 * A button beside a hero that can play it, a link everywhere else, and neither
 * when the only battle it holds is still in review. The three share their
 * inside, so the picture is written once.
 */
export function Thumbnail({
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
export function BattleRow({
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
      ? "cursor-pointer text-fd-muted-foreground/50"
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
    <button type="button" onClick={onPlay} className={className}>
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
