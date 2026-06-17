"use client";

import { usePathname } from "next/navigation";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { isRegion, Region, regionFromPathname } from "@/services/wargaming/wot";

/**
 * Region the user is operating in, derived from the URL first then the
 * cookie. Lives client-side so soft-navs stay in sync (the root layout
 * doesn't re-execute and SSR-frozen values would otherwise drift).
 *
 * URL wins when the path is regional (`/na/...`, `/asia/...`). On
 * region-less paths like `/`, `/coverage`, or `/players`, the cookie
 * decides so a switch made elsewhere (search dialog, region selector)
 * carries over to whoever reads us next.
 */
export function useRegion(): Region {
  const pathname = usePathname();
  const [stored] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  return (
    regionFromPathname(pathname) ?? (isRegion(stored) ? stored : Region.EU)
  );
}
