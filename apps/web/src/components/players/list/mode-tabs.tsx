import Link from "@/components/link";
import { Panel, PanelHeader } from "@/components/panel";
import ROUTES from "@/constants/routes";
import { TabNav, tabClass } from "@/components/tab-nav";
import type { Region } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";
import { battleTypeName } from "@/components/game-name";
import { BattleType } from "@unicum.gg/shared";

// The game-mode tabs on the player landing: "Overall" (the WNX rating board at
// /players) and "Steel Hunter" (the HR battle-royale board at
// /players/steel-hunter). Mirrors the clan landing's StrongholdTierTabs so the
// two pages read as siblings. `active` highlights the current board.
export async function PlayersModeTabs({
  region,
  active,
  locale,
}: {
  region: Region;
  active: "overall" | "steel-hunter" | "onslaught";
  /** The route's own segment: three links and no state, so this stays on the
   * server rather than shipping to the browser to read three words. */
  locale: string;
}) {
  // The two game modes are Wargaming's own words: a French player reads
  // "Traque d'acier" and "Offensive", never the English.
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/players/list/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  return (
    <Panel>
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <TabNav>
          <Link
            href={ROUTES.PLAYERS(region)}
            className={tabClass(active === "overall")}
          >
            {t("modes.overall")}
          </Link>
          <Link
            href={ROUTES.PLAYERS_STEEL_HUNTER(region)}
            className={tabClass(active === "steel-hunter")}
          >
            {battleTypeName(BattleType.BattleRoyale, tGame)}
          </Link>
          <Link
            href={ROUTES.PLAYERS_ONSLAUGHT(region)}
            className={tabClass(active === "onslaught")}
          >
            {battleTypeName(BattleType.Onslaught, tGame)}
          </Link>
        </TabNav>
      </PanelHeader>
    </Panel>
  );
}
