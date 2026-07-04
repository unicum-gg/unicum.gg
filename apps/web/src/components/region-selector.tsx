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
} from "@unicum.gg/wargaming/region";

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

function targetForRegion(pathname: string, region: Region): string {
  if (COVERAGE_PATHS.has(pathname)) return ROUTES.COVERAGE(region);
  if (CLANS_PATTERN.test(pathname)) return ROUTES.CLANS(region);
  if (PLAYERS_PATTERN.test(pathname)) return ROUTES.PLAYERS(region);
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
        router.push(targetForRegion(pathname, v));
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
