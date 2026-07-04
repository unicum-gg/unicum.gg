"use client";

import Link from "next/link";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { isRegion, Region } from "@unicum.gg/wargaming/region";

/**
 * "See all →" affordance rendered in the Top clans panel header. Mirrors
 * the region resolution used by `TopClans` (regionOverride wins, then the
 * cookie, then EU) so the link always points to the leaderboard the user
 * is actually looking at.
 */
export function TopClansLeaderboardLink({
  regionOverride,
}: {
  regionOverride?: Region;
}) {
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  return (
    <Link
      href={ROUTES.CLANS(region)}
      className={cn(
        styles.linkHover,
        "text-xs font-medium uppercase tracking-wide text-fd-muted-foreground",
      )}
    >
      See all →
    </Link>
  );
}
