import type { TranslateFunction } from "@onruntime/translations";
import { BATTLE_ALL, type BattleTab } from "@/components/maps/list/tabs";
import { battleTypeName } from "@/components/game-name";

// Per-tab wording for the map gallery. Each battle type is its own indexable
// URL, so it gets its own heading, on-page intro, title and description.
//
// Pure and framework-free so both sides can use it: the server page (for
// `generateMetadata`) and the client gallery, which re-renders the heading when
// the user switches tab without a server round-trip. One source means the <h1>
// and the <title> can never describe different tabs.
//
// The words live in `components/maps/list/copy`, and the battle type's own name
// comes from `game/vocabulary`: it is Wargaming's, and every language the game
// ships in has its own for it.

export type MapsTabCopy = {
  heading: string;
  intro: (count: number, regionLabel: string) => string;
  title: (regionLabel: string) => string;
  description: (regionLabel: string) => string;
};

export function mapsTabCopy(
  tab: BattleTab,
  t: TranslateFunction,
  tGame: TranslateFunction,
): MapsTabCopy {
  if (tab === BATTLE_ALL) {
    return {
      heading: t("all.heading"),
      intro: (count) => t("all.intro", { count }),
      title: (region) => t("all.title", { region }),
      description: (region) => t("all.description", { region }),
    };
  }

  const type = battleTypeName(tab, tGame);
  // One clause saying what the mode IS, so the intro says something real
  // instead of repeating the tab name.
  const blurb = t(`blurbs.${tab}`);
  return {
    heading: t("battle-type.heading", { type }),
    intro: (count) => t("battle-type.intro", { count, type, blurb }),
    title: (region) => t("battle-type.title", { type, region }),
    description: (region) => t("battle-type.description", { type, region }),
  };
}
