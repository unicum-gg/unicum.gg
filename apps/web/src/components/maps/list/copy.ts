import { BattleType, BATTLE_TYPE_LABEL } from "@unicum.gg/shared";
import { BATTLE_ALL, type BattleTab } from "@/components/maps/list/tabs";

// Per-tab wording for the map gallery. Each battle type is its own indexable
// URL, so it gets its own heading, on-page intro, title and description.
//
// Pure and framework-free so both sides can use it: the server page (for
// `generateMetadata`) and the client gallery, which re-renders the heading when
// the user switches tab without a server round-trip. One source means the <h1>
// and the <title> can never describe different tabs.

export type MapsTabCopy = {
  heading: { lead: string; accent: string };
  intro: (count: number, regionLabel: string) => string;
  title: (regionLabel: string) => string;
  description: (regionLabel: string) => string;
};

/** What each battle type is, in one clause, so the intro says something real
 * instead of repeating the tab name. */
const BATTLE_TYPE_BLURB: Record<BattleType, string> = {
  [BattleType.Random]: "the standard 15v15 rotation",
  [BattleType.BattleRoyale]: "the Steel Hunter last-tank-standing mode",
  [BattleType.Frontline]: "the 30v30 large-scale mode",
  [BattleType.Onslaught]: "the ranked 7v7 mode",
  [BattleType.OnslaughtNight]:
    "the ranked 7v7 mode after dark, on shorter view range, currently playable on the Common Test",
  [BattleType.GrandBattle]: "the 30v30 tier X mode",
  [BattleType.ClanWars]: "clan wars and advances",
  [BattleType.Waffentrager]: "the Waffenträger event",
  [BattleType.LastStand]: "the Last Stand event",
  [BattleType.Arcade]: "arcade and special events",
  [BattleType.StoryMode]: "the story-driven operations",
  [BattleType.Training]: "training rooms and tutorials",
};

export function mapsTabCopy(tab: BattleTab): MapsTabCopy {
  if (tab === BATTLE_ALL) {
    return {
      heading: { lead: "All", accent: "maps" },
      intro: (count) =>
        `Every one of the ${count} World of Tanks battle arenas. Filter by camouflage and game mode, then open a map for its minimap, size and per-mode base flags and spawn points.`,
      title: (regionLabel) =>
        `All World of Tanks maps (${regionLabel}), every battle arena`,
      description: (regionLabel) =>
        `Browse every World of Tanks map on ${regionLabel}: minimaps, size, camouflage and supported game modes, with per-mode base flags and spawn points.`,
    };
  }

  const label = BATTLE_TYPE_LABEL[tab];
  const blurb = BATTLE_TYPE_BLURB[tab];
  return {
    heading: { lead: label, accent: "maps" },
    intro: (count) =>
      `The ${count} World of Tanks maps played in ${label}, ${blurb}. Open a map for its minimap, size and per-mode base flags and spawn points.`,
    title: (regionLabel) =>
      `World of Tanks ${label} maps (${regionLabel}), every arena in the rotation`,
    description: (regionLabel) =>
      `Every World of Tanks map in the ${label} rotation on ${regionLabel}: minimaps, size, camouflage and supported game modes, with base flags and spawn points.`,
  };
}
