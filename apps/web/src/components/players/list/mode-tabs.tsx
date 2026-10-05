import Link from "@/components/link";
import { Panel, PanelHeader } from "@/components/panel";
import { PlayerBoard } from "@/components/players/list/boards";
import ROUTES from "@/constants/routes";
import { TabBar, tabItemClass } from "@/components/ui/tab-bar";
import type { Region } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";
import { battleTypeName } from "@/components/game-name";
import { BattleType } from "@unicum.gg/shared";

// The board tabs on the player landing: "Overall" (the WNX rating board at
// /players), the two game modes, and "3 Marks" (the Marks of Excellence board
// at /players/marks). Mirrors the clan landing's StrongholdTierTabs so the two
// pages read as siblings. `active` highlights the current board.
export async function PlayersModeTabs({
  region,
  active,
  locale,
}: {
  region: Region;
  active: PlayerBoard;
  /** The route's own segment: four links and no state, so this stays on the
   * server rather than shipping to the browser to read four words. */
  locale: string;
}) {
  // The game modes and the marks are Wargaming's own words: a French player
  // reads "Traque d'acier", "Offensive" and "3 marques", never the English. The
  // marks tab is `marks.3` from the catalogue rather than a string of ours, for
  // the reason `{stronghold} boosts` is composed: a label that is nothing but a
  // name has one right answer per language and it is already written down.
  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/players/list/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  return (
    <Panel>
      <PanelHeader className="px-0! py-0!" screenLines={false}>
        <TabBar>
          {/* A tab bar is a row of whole pages, and with no loading boundary in
            this tree Next prefetched each one in full on sight. See `prefetch`
            in `@/components/link`. */}
          <Link
            href={ROUTES.PLAYERS(region)}
            prefetch="intent"
            className={tabItemClass(active === PlayerBoard.Overall)}
          >
            {t("modes.overall")}
          </Link>
          <Link
            href={ROUTES.PLAYERS_MARKS(region)}
            prefetch="intent"
            className={tabItemClass(active === PlayerBoard.Marks)}
          >
            {tGame("marks.3")}
          </Link>
          <Link
            href={ROUTES.PLAYERS_STEEL_HUNTER(region)}
            prefetch="intent"
            className={tabItemClass(active === PlayerBoard.SteelHunter)}
          >
            {battleTypeName(BattleType.BattleRoyale, tGame)}
          </Link>
          <Link
            href={ROUTES.PLAYERS_ONSLAUGHT(region)}
            prefetch="intent"
            className={tabItemClass(active === PlayerBoard.Onslaught)}
          >
            {battleTypeName(BattleType.Onslaught, tGame)}
          </Link>
        </TabBar>
      </PanelHeader>
    </Panel>
  );
}
