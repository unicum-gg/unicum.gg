"use client";

import { usePathname } from "next/navigation";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { isRegion, Region, regionFromPathname } from "@unicum.gg/wargaming";

/**
 * Region the user is operating in, with a setter that persists to the
 * region cookie. Lives client-side so soft-navs stay in sync (the root
 * layout doesn't re-execute and SSR-frozen values would otherwise drift).
 *
 * URL wins when the path is regional (`/na/...`, `/asia/...`). On
 * region-less paths like `/`, `/coverage`, or `/players`, the cookie
 * decides so a switch made elsewhere (search dialog, region selector)
 * carries over to whoever reads us next.
 *
 * `setRegion` only writes the cookie. Callers that also need to navigate
 * (e.g. `RegionSelector` pushing the user to the equivalent route in the
 * new region) must do that themselves.
 */
export function useRegion(): {
  region: Region;
  setRegion: (region: Region) => void;
} {
  const pathname = usePathname();
  const [stored, setStored] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region =
    regionFromPathname(pathname) ?? (isRegion(stored) ? stored : Region.EU);
  return { region, setRegion: setStored };
}
