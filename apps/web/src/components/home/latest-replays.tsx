"use client";

import { isRegion, Region } from "@unicum.gg/wargaming";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { PanelHeaderLink } from "@/components/panel-header-link";
import { PlayerBattlesTable } from "@/components/players/detail/overview/battles-table";
import type { BattlesCatalogPayload } from "@/components/battles/list/catalog";
import { topBattleRows } from "@/components/tanks/detail/loadouts/build-views";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import { useTranslation } from "@/hooks/use-translation";

/**
 * The newest replays of the reader's server, drawn as the replay catalogue
 * draws them, with the way into the whole catalogue in the header.
 *
 * The page is static and every server's rows are fetched with it, like the
 * boards above, so the region the reader browses picks the list without a
 * request. Absent rather than empty when a server has none yet.
 */
export function LatestReplays({
  initial,
  regionOverride,
}: {
  initial: Record<Region, BattlesCatalogPayload | null>;
  regionOverride?: Region;
}) {
  const { t } = useTranslation("components/home/latest-replays");
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  const { wnMetric: metric } = useRatingMetric();
  const payload = initial[region];
  if (!payload?.battles.length) return null;
  const rows = topBattleRows({ topBattles: payload.battles }).map((row, index) => ({
    ...row,
    replayStats: payload.battles[index]?.stats,
  }));

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>{t("title")}</PanelTitle>
        <PanelHeaderLink href={ROUTES.BATTLES(region)}>{t("all")}</PanelHeaderLink>
      </PanelHeader>
      <PanelContent className="p-0">
        <PlayerBattlesTable
          region={region}
          metric={metric}
          battles={rows}
          withVehicle
          battleHref={(battle) =>
            battle.player
              ? ROUTES.BATTLE_PLAYER(region, battle.id, battle.player.accountId)
              : ROUTES.BATTLE(region, battle.id)
          }
        />
      </PanelContent>
    </Panel>
  );
}
