// Pure, framework-free clan tab definitions shared by the server page (which
// reads the active tab from the URL) and the client nav/view. Kept out of the
// "use client" `tabs-nav.tsx` so `tabFromQuery` stays callable from Server
// Components.
export enum ClanTab {
  Overview = "overview",
  Tanks = "tanks",
  Stronghold = "stronghold",
  ClanWars = "clan-wars",
}

export const CLAN_TABS: { id: ClanTab; label: string; query: string | null }[] =
  [
    { id: ClanTab.Overview, label: "Overview", query: null },
    { id: ClanTab.Tanks, label: "Tanks", query: "tanks" },
    { id: ClanTab.Stronghold, label: "Stronghold", query: "stronghold" },
    { id: ClanTab.ClanWars, label: "Clan Wars", query: "clan-wars" },
  ];

export function tabFromQuery(query: string | null | undefined): ClanTab {
  const found = CLAN_TABS.find((t) => t.query === query);
  return found ? found.id : ClanTab.Overview;
}

// Canonical URL for a tab. The default (Overview) tab has no query so the base
// path stays clean. Shared between the anchor `href` in the nav and the
// `pushState` call in the view, so both always agree.
export function clanTabHref(basePath: string, tab: ClanTab): string {
  const def = CLAN_TABS.find((t) => t.id === tab);
  return def?.query ? `${basePath}?tab=${def.query}` : basePath;
}
