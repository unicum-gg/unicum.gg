"use client";

import { useLocale } from "@onruntime/translations/react";
import type { Region } from "@unicum.gg/wargaming";
import { ShareButton } from "@/components/share-button";
import { mapName } from "@/components/game-name";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { localizePath } from "@/lib/translations";
import { BattleTab } from "./battle-types";

/**
 * Hand this battle to somebody, from wherever it was opened.
 *
 * A battle has a page of its own for exactly this, and nothing led to it: a
 * reader who opened a good game inside a player's list had no link to give.
 * The link is the battle's own page in the reader's language, and it opens on
 * the replay when that is what the reader was watching, since a replay is the
 * thing people send each other and landing on the rosters would bury it.
 */
export function BattleShare({
  region,
  battleId,
  arenaId,
  replay,
}: {
  region: Region;
  battleId: string;
  arenaId: string;
  /** Whether the reader is on the replay, which the link then opens on. */
  replay: boolean;
}) {
  const { locale } = useLocale();
  const { t: tMaps } = useTranslation("game/maps");
  const title = mapName(arenaId, arenaId, tMaps);
  const url = `${APP.URL}${localizePath(ROUTES.BATTLE(region, battleId), locale)}${
    replay ? `?tab=${BattleTab.Replay}` : ""
  }`;
  return (
    <ShareButton
      title={title}
      url={url}
      shareText={url}
      nativeShareTitle={title}
    />
  );
}
