"use client";

import { useEffect } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Region } from "@unicum.gg/wargaming";
import { replayDownloadPath } from "@/components/players/detail/overview/battle-download";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { unicum } from "@/services/sdk";

/**
 * The recording's own download, as the page's main action, with how many
 * people opened and downloaded it.
 *
 * A view is counted from here, once the page is actually on screen, so a
 * crawler or a link preview that never runs it is not one. The endpoint counts
 * once an hour per address, so a reload is not either.
 */
export function ReplayStats({
  region,
  battleId,
  recorder,
  clientVersion,
  views,
  downloads,
}: {
  region: Region;
  battleId: string;
  recorder: number;
  clientVersion: string | null;
  views: number;
  downloads: number;
}) {
  const { t } = useTranslation("components/battles/detail/replay-stats");
  const { num } = useFormat();
  const count = num();

  useEffect(() => {
    unicum
      .region(region)
      .battles(battleId)
      .view({ recorder })
      .catch(() => {});
  }, [region, battleId, recorder]);

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <Button asChild size="lg" className="gap-2">
        <a href={replayDownloadPath(region, battleId, recorder)} download>
          <DownloadSimpleIcon className="size-4" weight="bold" />
          {t("download")}
        </a>
      </Button>
      <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs sm:justify-end">
        {clientVersion ? <span>{t("version", { version: clientVersion })}</span> : null}
        <span>{t("views", { value: count.format(views) })}</span>
        <span>{t("downloads", { value: count.format(downloads) })}</span>
      </span>
    </div>
  );
}
