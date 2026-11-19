"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/use-translation";

/** Where a battle's archived `.wotreplay` is served from. */
export function replayDownloadPath(
  region: Region,
  battleId: string,
  recorder?: number,
): string {
  const path = `/api/${region}/battles/${battleId}/replay/download`;
  return recorder === undefined ? path : `${path}?recorder=${recorder}`;
}

/**
 * The battle's own `.wotreplay`, to open in the game.
 *
 * Beside the share button and drawn like it. The tooltip names the client
 * version, because the game only plays a replay on the build that recorded it,
 * and a player who downloads one recorded two patches ago deserves to know
 * before their client refuses it.
 */
export function BattleDownload({
  region,
  battleId,
  recorder,
  clientVersion,
}: {
  region: Region;
  battleId: string;
  /** Whose recording, when the battle has several. */
  recorder?: number;
  clientVersion: string | null;
}) {
  const { t } = useTranslation("components/players/detail/overview/battle-download");
  const label = clientVersion
    ? t("download-version", { version: clientVersion })
    : t("download");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={replayDownloadPath(region, battleId, recorder)}
            download
            aria-label={label}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
          >
            <DownloadSimpleIcon className="size-3.5" weight="bold" />
          </a>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
