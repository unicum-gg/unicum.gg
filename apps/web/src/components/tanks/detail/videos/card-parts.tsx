"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import Link from "@/components/link";
import {
  formatTimestamp,
} from "@unicum.gg/shared";
import { MapPinIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TankVideoCardData } from "./card";
import { mapModeName, mapName } from "@/components/game-name";
import { useTranslation } from "@/hooks/use-translation";

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
  const { t: tVideos } = useTranslation("components/tanks/detail/videos/index");
  const { t } = useTranslation("components/tanks/detail/videos/card-parts");
  const className = "group relative block size-full";
  if (onPlay)
    return (
      <button
        type="button"
        onClick={onPlay}
        aria-label={tVideos("play", { title })}
        className={cn(className, "cursor-pointer")}
      >
        {children}
      </button>
    );
  if (href)
    return (
      <Link href={href} aria-label={t("watch", { title })} className={className}>
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
  onEdit,
}: {
  battle: TankVideoCardData;
  showTank: boolean;
  active: boolean;
  /** Given where a hero can play the battle in place. Without it the row is a
   * link to the tank's page, which is where it can be watched. */
  onPlay?: () => void;
  href: string | null;
  /** Opens the correction dialog, on a queued row of one's own. Passed like
   * `onPlay` beside it, since the dialog is the player provider's and this
   * module is also used on cards mounted outside one. */
  onEdit?: () => void;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/tanks/detail/videos/card-parts");
  const { t: tVideos } = useTranslation("components/tanks/detail/videos/index");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tMaps } = useTranslation("game/maps");
  // The map first, since it is what anyone scans for, then how the battle was
  // played, then which side of it they started from.
  const facts = [
    showTank ? battle.tankName : null,
    battle.arenaId
      ? mapName(battle.arenaId, battle.mapName ?? battle.arenaId, tMaps)
      : battle.mapName,
    battle.mode ? mapModeName(battle.mode, tGame) : null,
    // The raw direction, not the label core derived: that one was resolved
    // server-side in English, and this one is the reader's own word.
    battle.direction
      ? tGame(`spawn-directions.${battle.direction}`)
      : battle.directionLabel,
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
            {tGame(`battle-results.${battle.result}`)}
          </span>
        )}
        {battle.combinedDamage !== null && (
          <span className="tabular-nums">
            {numberFormat(locale).format(battle.combinedDamage)}
            <span className="text-fd-border"> {tVideos("dmg")}</span>
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

  // Nothing to add to a row that is neither the reader's nor waiting: it is
  // just a link to a video.
  if (!battle.pending && !onEdit) return row;

  // The pencil goes on both kinds of row the reader owns. On a queued one it
  // sits beside the note saying why the row is greyed out; on a published one
  // it is the only thing that marks the row as theirs, and the row itself still
  // opens the video, since checking the second one picked is the other thing it
  // is for.
  return (
    <TooltipProvider>
      <span className="flex w-full items-center gap-1">
        {battle.pending ? (
          <Tooltip>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent>
              {t("waiting-on-a-moderator-only")}</TooltipContent>
          </Tooltip>
        ) : (
          row
        )}
        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onEdit}
                aria-label={t("correct-this-suggestion")}
                className={cn(
                  "shrink-0 cursor-pointer rounded-md p-1 transition-colors hover:bg-fd-muted hover:text-fd-foreground",
                  battle.pending
                    ? "text-fd-muted-foreground/50"
                    : "text-fd-muted-foreground",
                )}
              >
                <PencilSimpleIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {battle.pending
                ? t("correct-it")
                : t("correct-it-goes-back")}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  );
}
