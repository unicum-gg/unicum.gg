// Pure, framework-free tab definitions shared by the server page (which reads
// the active tab from the URL) and the client nav/view. Kept out of the
// "use client" `tabs-nav.tsx` so `tabFromQuery` stays callable from Server
// Components.
export enum PlayerTab {
  Overall = "overall",
  Skirmish = "skirmish",
  Advances = "advances",
  GrandBattles = "grand",
  RankedBattles = "ranked",
  ClanWarsX = "cw-x",
  ClanWarsVIII = "cw-viii",
  ClanWarsVI = "cw-vi",
  SteelHunter = "steel-hunter",
}

export const PLAYER_TABS: { id: PlayerTab; label: string; query: string | null }[] =
  [
    { id: PlayerTab.Overall, label: "Random Battles", query: null },
    { id: PlayerTab.Skirmish, label: "Skirmish", query: "skirmish" },
    { id: PlayerTab.Advances, label: "Advances", query: "advances" },
    { id: PlayerTab.GrandBattles, label: "Grand Battles", query: "grand" },
    { id: PlayerTab.RankedBattles, label: "Ranked Battles", query: "ranked" },
    { id: PlayerTab.ClanWarsX, label: "Clan Wars X", query: "cw-x" },
    { id: PlayerTab.ClanWarsVIII, label: "Clan Wars VIII", query: "cw-viii" },
    { id: PlayerTab.ClanWarsVI, label: "Clan Wars VI", query: "cw-vi" },
    { id: PlayerTab.SteelHunter, label: "Steel Hunter", query: "steel-hunter" },
  ];

export function tabFromQuery(query: string | null | undefined): PlayerTab {
  const found = PLAYER_TABS.find((t) => t.query === query);
  return found ? found.id : PlayerTab.Overall;
}

// Canonical URL for a tab. The default (Overall) tab has no query so the base
// path stays clean. Shared between the anchor `href` in the nav and the
// `pushState` call in the view, so both always agree.
export function playerTabHref(basePath: string, tab: PlayerTab): string {
  const def = PLAYER_TABS.find((t) => t.id === tab);
  return def?.query ? `${basePath}?tab=${def.query}` : basePath;
}
