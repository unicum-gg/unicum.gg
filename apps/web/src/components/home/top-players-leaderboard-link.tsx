"use client";

import Link from "next/link";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { isRegion, Region } from "@unicum.gg/wargaming";

/**
 * "See all →" affordance rendered in the Top players Overall panel
 * header. Mirrors the region resolution used by `TopPlayers` so the
 * link always points to the leaderboard the user is actually looking
 * at. Only shown on the Overall panel. The 24h/7d periods don't have
 * a dedicated landing page yet.
 */
export function TopPlayersLeaderboardLink({
  regionOverride,
}: {
  regionOverride?: Region;
}) {
  const [storedRegion] = useCookie(STORAGE.COOKIES.REGION, Region.EU);
  const region: Region =
    regionOverride ?? (isRegion(storedRegion) ? storedRegion : Region.EU);
  return (
    <Link
      href={ROUTES.PLAYERS(region)}
      className={cn(
        styles.linkHover,
        "text-xs font-medium uppercase tracking-wide text-fd-muted-foreground",
      )}
    >
      See all →
    </Link>
  );
}
