"use client";

import { usePathname, useRouter } from "next/navigation";
import ROUTES from "@/constants/routes";
import {
  MAPS_TAB_ROOT as TAB_ROOT,
  mapsTabFromPathname,
  mapsTabHref,
} from "@/components/maps/list/tabs";
import { useRegion } from "@/hooks/use-region";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isRegion,
  REGION_EMOJI,
  REGION_LABEL,
  REGIONS,
  Region,
} from "@unicum.gg/wargaming";

const COVERAGE_PATHS = new Set<string>(REGIONS.map((r) => ROUTES.COVERAGE(r)));
// Any `/clans`, `/eu/clans/...`, `/na/clans/lang/pt`, etc. Clans, languages,
// and strict mode are all region-scoped, so the only sensible landing when
// the user switches region is the new region's clans index.
const CLANS_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?clans(?:/|$)`,
);
// Mirror for /players. Same reasoning: a per-language top-players page
// makes no sense after a region switch, so we drop the user on the new
// region's players index.
const PLAYERS_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?players(?:/|$)`,
);
// Tanks are region-scoped in the URL but the catalogue is identical across
// regions, so on a tank detail page we keep the same tank in the new region;
// on the index we just swap to the new region's index.
const TANKS_PATTERN = new RegExp(`^/(?:(?:${REGIONS.join("|")})/)?tanks(?:/|$)`);
// Captures the slug and, when present, the tab segment (`/performances`,
// `/marks`), so switching region keeps the tab the user is on.
const TANK_SLUG_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?tanks/([^/?#]+)(/[^/?#]+)?`,
);
// Maps behave like tanks: the arenas are the same game everywhere, so a switch
// keeps the map you are reading. Only the Clan Wars pool it belongs to is
// regional, and that is a tab of the page rather than a different page.
const MAPS_PATTERN = new RegExp(`^/(?:(?:${REGIONS.join("|")})/)?maps(?:/|$)`);
const MAP_SLUG_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?maps/([^/?#]+)`,
);
// The section root as it appears in THIS pathname, region prefix included or
// not, which is what the tab helpers measure their segment against.
const MAPS_BASE_PATTERN = new RegExp(`^/(?:(?:${REGIONS.join("|")})/)?maps`);
// The changes feed is its own page under /maps, so it has to be recognised
// before the slug pattern claims "changes" as a map name.
const MAPS_CHANGES_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?maps/changes(?:/|$)`,
);
// Servers and tournaments land on the new region's index, like clans and
// players: a cluster and a tournament both belong to one realm, so there is
// nothing of the current page to carry across.
const SERVERS_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?servers(?:/|$)`,
);
const TOURNAMENTS_PATTERN = new RegExp(
  `^/(?:(?:${REGIONS.join("|")})/)?tournaments(?:/|$)`,
);

function targetForRegion(
  pathname: string,
  search: string,
  region: Region,
): string {
  if (COVERAGE_PATHS.has(pathname)) return ROUTES.COVERAGE(region);
  if (CLANS_PATTERN.test(pathname)) return ROUTES.CLANS(region);
  if (PLAYERS_PATTERN.test(pathname)) return ROUTES.PLAYERS(region);
  if (TANKS_PATTERN.test(pathname)) {
    // The catalogue is identical across regions, so we keep the same tank, its
    // tab segment, and its query (the index filters) in the new region.
    const match = pathname.match(TANK_SLUG_PATTERN);
    const slug = match?.[1];
    const tabSegment = match?.[2] ?? "";
    const base = slug
      ? `${ROUTES.TANK(region, slug)}${tabSegment}`
      : ROUTES.TANKS(region);
    return `${base}${search}`;
  }
  if (MAPS_CHANGES_PATTERN.test(pathname)) return ROUTES.MAPS_CHANGES(region);
  if (MAPS_PATTERN.test(pathname)) {
    // The same map in the new region, with its query (the mode view, the
    // gallery's filters). The gallery's `/all/<battle type>` segment is carried
    // across like the tank page's tab is: it is a place in the section, and
    // switching server should not also send the reader back to every battle
    // type. `all` is not a slug, it is the tab root.
    const slug = pathname.match(MAP_SLUG_PATTERN)?.[1];
    if (slug && slug !== TAB_ROOT) return `${ROUTES.MAP(region, slug)}${search}`;
    const currentBase = pathname.match(MAPS_BASE_PATTERN)?.[0] ?? ROUTES.MAPS(region);
    const tab = mapsTabFromPathname(pathname, currentBase);
    return `${mapsTabHref(ROUTES.MAPS(region), tab)}${search}`;
  }
  if (SERVERS_PATTERN.test(pathname)) return ROUTES.SERVERS(region);
  if (TOURNAMENTS_PATTERN.test(pathname)) return ROUTES.TOURNAMENTS(region);
  return ROUTES.HOME(region);
}

export function RegionSelector() {
  const pathname = usePathname();
  const router = useRouter();
  const { region, setRegion } = useRegion();

  function selectRegion(next: Region) {
    setRegion(next);
    // `window.location.search` includes the leading "?"; empty string when
    // there is no query.
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(targetForRegion(pathname, search, next));
  }

  return (
    <Select
      value={region}
      onValueChange={(v) => {
        if (!isRegion(v)) return;
        selectRegion(v);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Region"
        className="h-8 w-fit gap-1.5 rounded-full border-fd-border bg-fd-secondary/50 px-2.5 text-xs font-medium uppercase"
      >
        <SelectValue>
          <RegionItem region={region} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* `onValueChange` alone is not enough, because the displayed region and
            the URL can disagree: on a region-less path (`/`, `/coverage`,
            `/players`) `useRegion` falls back to the cookie, so landing on `/`
            with an `asia` cookie (a back-navigation out of `/asia`, a link to
            `/`) shows ASIA in the selector while the URL stays `/`. Picking ASIA
            there is a no-op for Radix, which only fires on an actual value
            change, so the user was stuck on `/` — with asia data on screen,
            since the content follows the cookie. Handling the click as well
            makes re-picking the current region navigate to its URL. The two
            paths are disjoint (this only fires when the value is unchanged), so
            a real switch still navigates once. */}
        {REGIONS.map((r) => (
          <SelectItem
            key={r}
            value={r}
            onClick={() => {
              if (r === region) selectRegion(r);
            }}
          >
            <RegionItem region={r} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegionItem({ region }: { region: Region }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-base leading-none">
        {REGION_EMOJI[region]}
      </span>
      {REGION_LABEL[region]}
    </span>
  );
}
