"use client";

import { useLocale } from "@onruntime/translations/react";
import type { Region } from "@unicum.gg/wargaming";
import { ShareButton } from "@/components/share-button";
import { mapName } from "@/components/game-name";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useTranslation } from "@/hooks/use-translation";
import { localizePath } from "@/lib/translations";
import { BattleParam, BattleTab } from "./battle-types";
import { useBattleUrlView } from "./use-battle-view";

/**
 * Hand this battle to somebody, from wherever it was opened.
 *
 * A battle has a page of its own for exactly this, and nothing led to it: a
 * reader who opened a good game inside a player's list had no link to give.
 * The link is the battle's own page in the reader's language, and it opens on
 * the replay when that is what the reader was watching, since a replay is the
 * thing people send each other and landing on the rosters would bury it. A
 * player opened on the rosters rides along the same way, so "look at this
 * line" lands on that line.
 */
export function BattleShare({
  region,
  battleId,
  arenaId,
  replay,
  player,
}: {
  region: Region;
  battleId: string;
  arenaId: string;
  /** Whether the reader is on the replay, which the link then opens on. */
  replay: boolean;
  /** The player open on the rosters, by battle-scoped vehicle id. */
  player?: number | null;
}) {
  const { locale } = useLocale();
  const { t: tMaps } = useTranslation("game/maps");
  const title = mapName(arenaId, arenaId, tMaps);
  const params = new URLSearchParams();
  if (replay) params.set(BattleParam.Tab, BattleTab.Replay);
  else if (player) params.set(BattleParam.Player, String(player));
  const query = params.toString();
  const url = `${APP.URL}${localizePath(ROUTES.BATTLE(region, battleId), locale)}${
    query ? `?${query}` : ""
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

/**
 * The battle page's own share button, which sits above the battle and so reads
 * the view it hands over from the URL the battle keeps it in.
 */
export function BattlePageShare({
  region,
  battleId,
  arenaId,
  initialTab,
  initialPlayer,
}: {
  region: Region;
  battleId: string;
  arenaId: string;
  initialTab: BattleTab;
  initialPlayer: number | null;
}) {
  const { tab, player } = useBattleUrlView(initialTab, initialPlayer);
  return (
    <BattleShare
      region={region}
      battleId={battleId}
      arenaId={arenaId}
      replay={tab === BattleTab.Replay}
      player={tab === BattleTab.Teams ? player : null}
    />
  );
}
