// Tank detail page tabs. Each tab is its own route segment rather than a query
// param, so the server renders one tab instead of all three: passing every tab
// as a prop to a client tab bar made React render and serialize all of them into
// the flight payload, even the ones never mounted (measured 240kB of inline RSC
// on a 510kB page, and 0.9-3.5s of server render). Specifications is the default
// and lives at the bare path; the others get `/performances` and `/marks`.
export enum TankDetailTab {
  Specifications = "specifications",
  Performances = "performances",
  Marks = "marks",
  History = "history",
  Videos = "videos",
  Community = "community",
}

export const TANK_DETAIL_TABS: {
  id: TankDetailTab;
  label: string;
  segment: string | null;
}[] = [
  { id: TankDetailTab.Specifications, label: "Specifications", segment: null },
  {
    id: TankDetailTab.Performances,
    label: "Performances",
    segment: "performances",
  },
  { id: TankDetailTab.Marks, label: "Marks", segment: "marks" },
  { id: TankDetailTab.History, label: "History", segment: "history" },
  { id: TankDetailTab.Videos, label: "Videos", segment: "videos" },
  { id: TankDetailTab.Community, label: "Community", segment: "community" },
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
