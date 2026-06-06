"use client";

import { usePathname, useRouter } from "next/navigation";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
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
  regionFromPathname,
} from "@/services/wargaming/wot";

const COVERAGE_PATHS = new Set<string>(REGIONS.map((r) => ROUTES.COVERAGE(r)));

function targetForRegion(pathname: string, region: Region): string {
  if (COVERAGE_PATHS.has(pathname)) return ROUTES.COVERAGE(region);
  return ROUTES.HOME(region);
}

export function RegionSelector() {
  const [stored, setStored] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const pathname = usePathname();
  const router = useRouter();

  // URL wins when regional ("/eu/..."); fall back to the cookie when the
  // path has no region prefix (e.g. "/" or "/coverage"), so a change made
  // in the search dialog is reflected here once useCookie broadcasts it.
  const region: Region =
    regionFromPathname(pathname) ??
    (isRegion(stored) ? stored : Region.EU);

  return (
    <Select
      value={region}
      onValueChange={(v) => {
        if (!isRegion(v)) return;
        setStored(v);
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
