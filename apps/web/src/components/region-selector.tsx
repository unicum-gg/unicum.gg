"use client";

import { usePathname, useRouter } from "next/navigation";
import ROUTES from "@/constants/routes";
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
  return ROUTES.HOME(region);
}

export function RegionSelector() {
  const pathname = usePathname();
  const router = useRouter();
  const { region, setRegion } = useRegion();

  return (
    <Select
      value={region}
      onValueChange={(v) => {
        if (!isRegion(v)) return;
        setRegion(v);
        // `window.location.search` includes the leading "?"; empty string when
        // there is no query.
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        router.push(targetForRegion(pathname, search, v));
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
        {REGIONS.map((r) => (
          <SelectItem key={r} value={r}>
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
