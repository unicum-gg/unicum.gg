// Map detail page tabs. Each tab is its own route segment rather than a query
// param, for the same reason the tank page's are: the server renders one tab
// instead of all of them, where passing every tab to a client tab bar would
// serialize the lot into the flight payload, even the ones never mounted.
//
// What they do NOT hold is the map itself. The minimap, the view pills and the
// stats beside them live in the layout, so they stay on screen whichever tab is
// open: a tactic has to be read under the ground it was fought on, and the
// selected view (an Onslaught layout, a Waffenträger variant) survives a tab
// change the way the tank page's hero keeps a video playing.
//
// Videos is the default and lives at the bare path, which is the map's
// canonical URL and the one in the sitemap. It is the default rather than
// Community because it is the tab with something on it today: a canonical page
// whose whole body is an empty rating form is not one worth indexing.
//
// Named for what it holds rather than for what it is mostly used for. It opens
// on the tactics, which is what the library is built around, but a second
// section under them lists the random battles people have linked, and a tab
// called Tactics was telling a reader the five random-battle videos below were
// not there.
export enum MapDetailTab {
  Videos = "videos",
  Community = "community",
  History = "history",
}

export const MAP_DETAIL_TABS: {
  id: MapDetailTab;
  segment: string | null;
}[] = [
  { id: MapDetailTab.Videos, segment: null },
  { id: MapDetailTab.Community, segment: "community" },
  { id: MapDetailTab.History, segment: "history" },
];

export function mapDetailTabHref(basePath: string, tab: MapDetailTab): string {
  const segment = MAP_DETAIL_TABS.find((t) => t.id === tab)?.segment;
  return segment ? `${basePath}/${segment}` : basePath;
}
