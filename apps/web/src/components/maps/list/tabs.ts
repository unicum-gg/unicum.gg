import { BattleType } from "@unicum.gg/shared";

// Battle-type tabs for the map gallery. Each type is its own route segment
// rather than the old `?type=` filter, so every one is a real indexable page
// with its own heading, title and description ("Frontline maps" is a query
// people actually search for, and it used to live behind a query param Google
// treats as one page).
//
// They sit under an `/all` segment (`/maps/all/frontline`) so they can never
// collide with a map slug: `/maps/frontline` would reserve that slug forever.
// Mirrors what the tank index does.
/** The gallery's tab segment, exported so callers that read a maps pathname
 * (the region selector) test against the same literal the hrefs are built
 * from, rather than repeating "all" and drifting from it. */
export const MAPS_TAB_ROOT = "all";
const TAB_ROOT = MAPS_TAB_ROOT;

/** The default tab, showing every map. Not a `BattleType` member on purpose:
 * `BattleType` describes what a map *is* (and rides the API/SDK), while "all"
 * is only a view state. It also softens the fact that "Random" is derived from
 * client-script geometry, not WG's live matchmaker rotation, so a few
 * event-only reskins leak into it. */
export const BATTLE_ALL = "all" as const;

export type BattleTab = BattleType | typeof BATTLE_ALL;

export function mapsTabHref(basePath: string, tab: BattleTab): string {
  return tab === BATTLE_ALL ? basePath : `${basePath}/${TAB_ROOT}/${tab}`;
}

/** The tab a pathname points at, so the client nav stays in sync across
 * back/forward. Anything that is not a known battle type falls back to "all". */
export function mapsTabFromPathname(
  pathname: string,
  basePath: string,
): BattleTab {
  const rest = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\/|\/$/g, "")
    : "";
  if (!rest.startsWith(`${TAB_ROOT}/`)) return BATTLE_ALL;
  const segment = rest.slice(TAB_ROOT.length + 1);
  return (
    (Object.values(BattleType) as string[]).includes(segment)
      ? (segment as BattleType)
      : BATTLE_ALL
  );
}

/** Parse a route param into a battle type, or null when it is not one. */
export function battleTypeFromSegment(segment: string): BattleType | null {
  return (Object.values(BattleType) as string[]).includes(segment)
    ? (segment as BattleType)
    : null;
}
