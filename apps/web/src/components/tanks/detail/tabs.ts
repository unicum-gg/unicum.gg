// Tank detail page tabs. Each tab is its own route segment rather than a query
// param, so the server renders one tab instead of all three: passing every tab
// as a prop to a client tab bar made React render and serialize all of them into
// the flight payload, even the ones never mounted (measured 240kB of inline RSC
// on a 510kB page, and 0.9-3.5s of server render). Specifications is the default
// and lives at the bare path; the others get `/performances` and `/marks`.
export enum TankDetailTab {
  Specifications = "specifications",
  Performances = "performances",
  Loadouts = "loadouts",
  Marks = "marks",
  History = "history",
  Videos = "videos",
  Community = "community",
}

export const TANK_DETAIL_TABS: {
  id: TankDetailTab;
  segment: string | null;
}[] = [
  { id: TankDetailTab.Specifications, segment: null },
  { id: TankDetailTab.Performances, segment: "performances" },
  { id: TankDetailTab.Loadouts, segment: "loadouts" },
  { id: TankDetailTab.Marks, segment: "marks" },
  { id: TankDetailTab.History, segment: "history" },
  { id: TankDetailTab.Videos, segment: "videos" },
  { id: TankDetailTab.Community, segment: "community" },
];

export function tankDetailTabHref(basePath: string, tab: TankDetailTab): string {
  const segment = TANK_DETAIL_TABS.find((t) => t.id === tab)?.segment;
  return segment ? `${basePath}/${segment}` : basePath;
}

/** Legacy `?tab=` values, kept so the old URLs can be redirected to the
 * equivalent segment instead of 404ing. */
export const LEGACY_TAB_QUERY: Record<string, TankDetailTab> = {
  performances: TankDetailTab.Performances,
  marks: TankDetailTab.Marks,
};

/**
 * Where a vehicle's own page lives, both prefixes included.
 *
 * The region has always been in the path and the language joined it, so
 * `/tanks/is-7` is also `/eu/tanks/is-7` and `/fr/eu/tanks/is-7`, and the same
 * page in Spanish on NA is three segments deep. Written for one optional
 * prefix, this matched an English reader's URL and no other, so every reader
 * browsing in a language lost the held frame between two vehicles.
 */
const VEHICLE_PAGE = /^\/(?:[a-z]{2,4}(?:-[a-z]{2,4})?\/){0,2}tanks\/(.+)$/;

/** The tab segments, which are what a vehicle's page may carry past its slug. */
const TAB_SEGMENTS = TANK_DETAIL_TABS.map((tab) => tab.segment).filter(
  (segment): segment is string => segment !== null,
);

/**
 * Segments that stand where a vehicle's slug stands and name a section.
 *
 * `/tanks/changes` and `/tanks/community` are in the menu every page carries,
 * so each is one click away from a vehicle's own page.
 */
const SECTIONS = ["all", "changes", "community"];

/**
 * Whether this address is a vehicle's own page, hero included.
 *
 * **Read to the end, which is the whole of the test.** Matched as a prefix,
 * every path that merely begins at a vehicle answers yes, and the comparison
 * does: `/tanks/is-3/vs/is-6` is a page of tables with no hangar in it.
 */
export function isVehiclePage(pathname: string): boolean {
  // Asked of a link's `href` as well as of the address bar, and a tab's own
  // link carries the battle it was opened on.
  const rest = VEHICLE_PAGE.exec(pathname.split(/[?#]/)[0])?.[1];
  if (!rest) return false;
  const [slug, tab, ...deeper] = rest.split("/").filter(Boolean);
  if (!slug || SECTIONS.includes(slug) || deeper.length > 0) return false;
  return tab === undefined || TAB_SEGMENTS.includes(tab);
}
