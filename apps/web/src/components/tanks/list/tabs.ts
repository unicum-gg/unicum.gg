// Pure, framework-free tank tab definitions shared by the server page (which
// renders one tab) and the client nav/view. Kept out of the "use client" nav so
// these stay callable from Server Components.
//
// Each tab is its own route segment rather than a query param, so the server
// embeds that tab's data group directly instead of always shipping Performances
// and letting the client fetch the right group on top. Performances is the
// default and lives at the bare path.
//
// The others sit under an `/all` segment (`/tanks/all/specifications`) rather
// than directly under `/tanks`, so they can never collide with a vehicle slug:
// `/tanks/economics` would reserve that slug forever and make a future tank of
// that name unreachable. It also mirrors the detail page's own tab segments.
export enum TankTab {
  Performances = "performances",
  Specifications = "specifications",
  Economics = "economics",
  MarksOfExcellence = "marks-of-excellence",
  MarksOfMastery = "marks-of-mastery",
  Videos = "videos",
}

export const TANK_TABS: {
  id: TankTab;
  label: string;
  segment: string | null;
}[] = [
  { id: TankTab.Performances, label: "Performances", segment: null },
  {
    id: TankTab.Specifications,
    label: "Specifications",
    segment: "specifications",
  },
  { id: TankTab.Economics, label: "Economics", segment: "economics" },
  {
    id: TankTab.MarksOfExcellence,
    label: "Marks of Excellence",
    segment: "marks-of-excellence",
  },
  {
    id: TankTab.MarksOfMastery,
    label: "Marks of Mastery",
    segment: "marks-of-mastery",
  },
  // Not a view of the tank table like the others: a list of what the community
  // has linked, which is why it carries its own panel rather than a column set.
  { id: TankTab.Videos, label: "Videos", segment: "videos" },
];

/** Parent segment of the non-default tabs, keeping them out of the slug space. */
const TAB_ROOT = "all";

export function tankTabHref(basePath: string, tab: TankTab): string {
  const segment = TANK_TABS.find((t) => t.id === tab)?.segment;
  return segment ? `${basePath}/${TAB_ROOT}/${segment}` : basePath;
}

/** The tab a pathname points at, for the client nav to stay in sync with the
 * URL across back/forward. Anything that is not a known segment (a tank slug,
 * for instance) falls back to the default. */
export function tankTabFromPathname(
  pathname: string,
  basePath: string,
): TankTab {
  const rest = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\/|\/$/g, "")
    : "";
  const segment = rest.startsWith(`${TAB_ROOT}/`)
    ? rest.slice(TAB_ROOT.length + 1)
    : null;
  return (
    TANK_TABS.find((t) => t.segment && t.segment === segment)?.id ??
    TankTab.Performances
  );
}

/** Legacy `?tab=` values, kept so the old URLs redirect to their segment. */
export const LEGACY_TANK_TAB_QUERY = TANK_TABS.map((t) => t.segment).filter(
  (s): s is string => s !== null,
);
